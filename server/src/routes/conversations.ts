import { Router, Request, Response } from "express";
import { listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const router = Router();

// GET /api/conversations — list all agent conversations
router.get("/conversations", async (_req: Request, res: Response) => {
  try {
    const sessions = await listSessions({ limit: 50 });

    const conversations = sessions
      .filter((s: any) => s.summary && s.summary.length > 0)
      .map((s: any) => ({
        id: s.sessionId,
        summary: s.summary.slice(0, 80),
        createdAt: s.createdAt || s.startedAt || null,
      }));

    res.json(conversations);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// GET /api/conversations/:id/messages — get messages for a session
router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const sdkMessages = await getSessionMessages(sessionId);

    // Map SDK messages to our frontend format
    const messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      events: Array<{
        id: string;
        type: string;
        content: string;
        toolName?: string;
        timestamp: string;
      }>;
      timestamp: string;
    }> = [];

    let currentAssistant: (typeof messages)[0] | null = null;

    for (const msg of sdkMessages) {
      const content = (msg as any).message?.content || (msg as any).content;
      const blocks = Array.isArray(content) ? content : [];

      if (msg.type === "user") {
        // Check if it's a tool_result (user message with tool_result blocks)
        const hasToolResult = blocks.some((b: any) => b.type === "tool_result");

        if (hasToolResult && currentAssistant) {
          // Append tool results to current assistant message
          for (const block of blocks) {
            if (block.type === "tool_result") {
              currentAssistant.events.push({
                id: crypto.randomUUID(),
                type: "tool_result",
                content: typeof block.content === "string"
                  ? block.content
                  : Array.isArray(block.content)
                    ? block.content.map((c: any) => c.text || "").join("\n")
                    : JSON.stringify(block.content),
                timestamp: new Date().toISOString(),
              });
            }
          }
        } else {
          // Regular user message
          const textContent = blocks
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text || "")
            .join("\n")
            // Strip IDE tags
            .replace(/<ide_[^>]*>[^<]*<\/ide_[^>]*>/g, "")
            .replace(/<ide_[^>]*>/g, "")
            .trim();

          if (textContent) {
            // Flush previous assistant
            if (currentAssistant) {
              messages.push(currentAssistant);
              currentAssistant = null;
            }

            messages.push({
              id: crypto.randomUUID(),
              role: "user",
              content: textContent,
              events: [],
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else if (msg.type === "assistant") {
        // Create or append to assistant message
        if (!currentAssistant) {
          currentAssistant = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            events: [],
            timestamp: new Date().toISOString(),
          };
        }

        for (const block of blocks) {
          if (block.type === "text" && block.text) {
            currentAssistant.content += block.text;
            currentAssistant.events.push({
              id: crypto.randomUUID(),
              type: "text",
              content: block.text,
              timestamp: new Date().toISOString(),
            });
          } else if (block.type === "tool_use") {
            currentAssistant.events.push({
              id: crypto.randomUUID(),
              type: "tool_use",
              content: JSON.stringify(block.input || {}),
              toolName: block.name,
              timestamp: new Date().toISOString(),
            });
          }
          // Skip thinking blocks
        }
      }
    }

    // Flush last assistant
    if (currentAssistant) {
      messages.push(currentAssistant);
    }

    res.json({ messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
