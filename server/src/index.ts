import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import path from "path";
import fs from "fs";
import { config } from "./utils/config.js";
import crypto from "crypto";
import { handleMessage, AgentChunk, clearSession } from "./agent.js";
import { startScheduler, setTaskCompleteHandler, loadTasks, getTaskResults } from "./scheduler.js";
import { startTelegramBot, sendNotification } from "./telegram.js";
import { generateToken, verifyToken, authMiddleware } from "./utils/auth.js";
import dashboardRouter from "./routes/dashboard.js";
import conversationsRouter from "./routes/conversations.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health check (public)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Login (public)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (username === config.authUsername && password === config.authPassword) {
    const token = generateToken(username);
    res.json({ token, username });
  } else {
    res.status(401).json({ error: "Nesprávné přihlašovací údaje" });
  }
});

// Protect all other /api routes
app.use("/api", authMiddleware);

// Dashboard routes
app.use("/api", dashboardRouter);

// Conversations routes
app.use("/api", conversationsRouter);

// One-shot chat endpoint (simple REST)
app.post("/api/chat", async (req, res) => {
  const { message, userId = "rest-default" } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing 'message' field" });
    return;
  }

  try {
    const chunks: AgentChunk[] = [];
    const fullResponse = await handleMessage(message, (chunk) => {
      chunks.push(chunk);
    }, userId);

    res.json({
      response: fullResponse,
      chunks,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// File serving — generated documents from data/outputs/
app.get("/api/files/:name", (req, res) => {
  const filename = req.params.name;
  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filepath = path.join(config.dataDir, "outputs", filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".csv": "text/csv",
  };

  const contentType = mimeTypes[ext] || "application/octet-stream";
  const inline = [".pdf", ".png", ".jpg", ".jpeg", ".svg"].includes(ext);

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${filename}"`
  );
  res.sendFile(filepath);
});

// XLSX/CSV preview — parse server-side, return JSON
app.get("/api/files/preview/:name", async (req, res) => {
  const filename = req.params.name;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filepath = path.join(config.dataDir, "outputs", filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    const XLSXModule = await import("xlsx");
    const XLSX = XLSXModule.default || XLSXModule;
    const workbook = XLSX.readFile(filepath);
    const sheets = workbook.SheetNames.map((name: string) => {
      const sheet = workbook.Sheets[name];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      return { name, rows: rows.slice(0, 500) }; // limit rows
    });
    res.json({ sheets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// Scheduled tasks API
app.get("/api/tasks", (_req, res) => {
  const tasks = loadTasks();
  const results = getTaskResults(undefined, 20);
  res.json({ tasks, recentResults: results });
});

// Create HTTP server
const server = http.createServer(app);

// Retry on EADDRINUSE (tsx watch on Windows: old process may not release port fast enough)
let retries = 0;
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" && retries < 5) {
    retries++;
    console.log(`[Server] Port ${config.port} busy, retry ${retries}/5...`);
    setTimeout(() => server.listen(config.port), 1000);
  } else {
    console.error(`[Server] Fatal: ${err.message}`);
    process.exit(1);
  }
});

// WebSocket server for streaming
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket, req) => {
  // Verify token from query param
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    ws.close(4001, "Unauthorized");
    return;
  }

  const userId = `web-${payload.username}-${crypto.randomUUID().slice(0, 8)}`;
  console.log(`WebSocket client connected: ${userId}`);

  ws.on("message", async (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === "chat" && data.content) {
        await handleMessage(data.content, (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chunk));

            // Detect artifact: any chunk mentioning outputs/ with a known file extension
            const ARTIFACT_EXTS = new Set([".xlsx", ".pdf", ".pptx", ".docx", ".png", ".jpg", ".jpeg", ".svg", ".csv"]);
            const chunkContent = chunk.content || "";
            const mentionsOutputs = chunkContent.includes("outputs") || chunkContent.includes("output");
            if ((chunk.type === "tool_result" || chunk.type === "tool_use" || chunk.type === "text") && mentionsOutputs) {
              const outputsDir = path.join(config.dataDir, "outputs");
              try {
                const files = fs.readdirSync(outputsDir)
                  .filter((f) => ARTIFACT_EXTS.has(path.extname(f).toLowerCase()))
                  .map((f) => ({ name: f, mtime: fs.statSync(path.join(outputsDir, f)).mtimeMs }))
                  .sort((a, b) => b.mtime - a.mtime);
                if (files.length > 0) {
                  const latest = files[0];
                  // Only send if file was modified in last 10 seconds (freshly created)
                  if (Date.now() - latest.mtime < 10000) {
                    const ext = path.extname(latest.name).slice(1).toLowerCase();
                    const size = fs.statSync(path.join(outputsDir, latest.name)).size;
                    ws.send(JSON.stringify({
                      type: "artifact",
                      filename: latest.name,
                      filetype: ext,
                      path: `/api/files/${encodeURIComponent(latest.name)}`,
                      size,
                    }));
                  }
                }
              } catch { /* ignore */ }
            }
          }
        }, userId);
      } else if (data.type === "clear") {
        // Allow frontend to reset conversation
        clearSession(userId);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "session_cleared" }));
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", content: msg }));
      }
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket client disconnected: ${userId}`);
    // Keep session alive — user might reconnect
  });
});

// Graceful shutdown — wait for server.close() before exiting
function shutdown() {
  console.log("\n[Server] Shutting down...");
  wss.clients.forEach((ws) => ws.close());
  wss.close();
  server.close(() => {
    console.log("[Server] Port released.");
    process.exit(0);
  });
  // Force exit after 2s if close hangs
  setTimeout(() => process.exit(0), 2000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start server
server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`WebSocket on ws://localhost:${config.port}/ws`);
  console.log(`Data directory: ${config.dataDir}`);

  // Start scheduler + wire notifications to Telegram
  setTaskCompleteHandler((result) => {
    const msg = `📋 *${result.taskName}*\n\n${result.response}`;
    sendNotification(msg);
  });
  startScheduler();

  // Start Telegram bot
  startTelegramBot();
});
