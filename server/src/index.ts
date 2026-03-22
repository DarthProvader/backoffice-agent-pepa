import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { config } from "./utils/config.js";
import crypto from "crypto";
import { handleMessage, AgentChunk, clearSession } from "./agent.js";
import { startScheduler, loadTasks, getTaskResults } from "./scheduler.js";

const app = express();
app.use(cors({ origin: config.webUrl }));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

// Scheduled tasks API
app.get("/api/tasks", (_req, res) => {
  const tasks = loadTasks();
  const results = getTaskResults(undefined, 20);
  res.json({ tasks, recentResults: results });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for streaming
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  // Each WS connection gets a stable userId
  const userId = `web-${crypto.randomUUID()}`;
  console.log(`WebSocket client connected: ${userId}`);

  ws.on("message", async (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === "chat" && data.content) {
        await handleMessage(data.content, (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chunk));
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

// Start server
server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`WebSocket on ws://localhost:${config.port}/ws`);
  console.log(`Data directory: ${config.dataDir}`);

  // Start scheduler after server is up
  startScheduler();
});
