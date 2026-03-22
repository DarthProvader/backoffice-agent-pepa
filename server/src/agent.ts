import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./utils/config.js";

export interface AgentChunk {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "done" | "error";
  content: string;
  toolName?: string;
}

export async function handleMessage(
  userMessage: string,
  onChunk: (chunk: AgentChunk) => void
): Promise<string> {
  let fullResponse = "";

  try {
    const conversation = query({
      prompt: userMessage,
      options: {
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
        cwd: config.dataDir,
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
      },
    });

    for await (const message of conversation) {
      if (typeof message !== "object" || message === null) continue;
      const msg = message as Record<string, unknown>;

      switch (msg.type) {
        case "assistant": {
          // Assistant message with content blocks
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
          // Tool results from agent's tool calls
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
          // Final result — contains the complete answer
          const result = msg.result as string | undefined;
          if (result && !fullResponse) {
            fullResponse = result;
            onChunk({ type: "text", content: result });
          }
          break;
        }
        // Ignore: system, rate_limit_event
      }
    }

    onChunk({ type: "done", content: "" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onChunk({ type: "error", content: errorMsg });
    fullResponse = `Chyba: ${errorMsg}`;
  }

  return fullResponse;
}
