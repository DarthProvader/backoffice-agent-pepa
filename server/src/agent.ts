import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./utils/config.js";

export interface AgentChunk {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "done" | "error";
  content: string;
  toolName?: string;
}

// Session store: userId → sessionId
const sessions = new Map<string, string>();

export function getSessionId(userId: string): string | undefined {
  return sessions.get(userId);
}

export function clearSession(userId: string) {
  sessions.delete(userId);
}

export async function handleMessage(
  userMessage: string,
  onChunk: (chunk: AgentChunk) => void,
  userId: string = "default"
): Promise<string> {
  let fullResponse = "";
  const existingSessionId = sessions.get(userId);

  try {
    const options: Record<string, unknown> = {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: `
Jsi Back Office Operations Agent pro českou realitní firmu.
Odpovídej vždy česky. Databáze je v ${config.dataDir}/backoffice.db.
Vygenerované soubory ukládej do ${config.dataDir}/outputs/.
Dnešní datum: ${new Date().toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}.
`,
      },
      cwd: config.projectRoot,
      settingSources: ["project"],
      tools: {
        type: "preset",
        preset: "claude_code",
      },
      allowedTools: [
        "Bash",
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "WebSearch",
        "WebFetch",
        "Skill",
      ],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 15,
      maxBudgetUsd: 0.5,
    };

    // Resume existing session if we have one
    if (existingSessionId) {
      options.resume = existingSessionId;
    }

    const conversation = query({
      prompt: userMessage,
      options: options as any,
    });

    for await (const message of conversation) {
      if (typeof message !== "object" || message === null) continue;
      const msg = message as Record<string, unknown>;

      switch (msg.type) {
        case "system": {
          // Capture session_id from init message
          if (msg.subtype === "init" && msg.session_id) {
            sessions.set(userId, msg.session_id as string);
            console.log(`[Agent] Session for ${userId}: ${msg.session_id}`);
          }
          break;
        }
        case "assistant": {
          const inner = msg.message as Record<string, unknown> | undefined;
          const content = (inner?.content ?? msg.content) as Array<Record<string, unknown>> | undefined;
          if (!content) break;
          for (const block of content) {
            if (block.type === "text") {
              const text = block.text as string;
              fullResponse += text;
              onChunk({ type: "text", content: text });
            } else if (block.type === "tool_use") {
              onChunk({
                type: "tool_use",
                content: JSON.stringify(block.input),
                toolName: block.name as string,
              });
            }
          }
          break;
        }
        case "user": {
          const inner = msg.message as Record<string, unknown> | undefined;
          const content = (inner?.content ?? msg.content) as Array<Record<string, unknown>> | undefined;
          if (!content) break;
          for (const block of content) {
            if (block.type === "tool_result") {
              onChunk({
                type: "tool_result",
                content: typeof block.content === "string"
                  ? block.content
                  : JSON.stringify(block.content),
              });
            }
          }
          break;
        }
        case "result": {
          // Capture session_id from result too (fallback)
          if (msg.session_id && !sessions.has(userId)) {
            sessions.set(userId, msg.session_id as string);
          }
          const result = msg.result as string | undefined;
          if (result && !fullResponse) {
            fullResponse = result;
            onChunk({ type: "text", content: result });
          }
          break;
        }
      }
    }

    onChunk({ type: "done", content: "" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // If session is corrupted, clear it so next message starts fresh
    if (existingSessionId) {
      console.log(`[Agent] Clearing broken session for ${userId}`);
      sessions.delete(userId);
    }
    onChunk({ type: "error", content: errorMsg });
    fullResponse = `Chyba: ${errorMsg}`;
  }

  return fullResponse;
}
