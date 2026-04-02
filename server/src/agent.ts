import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./utils/config.js";

export interface AgentChunk {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "done" | "error";
  content: string;
  toolName?: string;
}

export interface AgentHandle {
  promise: Promise<string>;
  abort: () => void;
}

// Session store: userId → sessionId
const sessions = new Map<string, string>();

export function getSessionId(userId: string): string | undefined {
  return sessions.get(userId);
}

export function clearSession(userId: string) {
  sessions.delete(userId);
}

export function setSessionId(userId: string, sessionId: string) {
  sessions.set(userId, sessionId);
}

/** Process SDK conversation messages, dispatch chunks to onChunk callback */
async function processConversation(
  conversation: ReturnType<typeof query>,
  userId: string,
  onChunk: (chunk: AgentChunk) => void,
  state: { fullResponse: string; aborted: boolean },
): Promise<string> {
  for await (const message of conversation) {
    if (state.aborted) break;
    if (typeof message !== "object" || message === null) continue;
    const msg = message as Record<string, unknown>;

    switch (msg.type) {
      case "system": {
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
            state.fullResponse += text;
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
        if (msg.session_id && !sessions.has(userId)) {
          sessions.set(userId, msg.session_id as string);
        }
        const result = msg.result as string | undefined;
        if (result && !state.fullResponse) {
          state.fullResponse = result;
          onChunk({ type: "text", content: result });
        }
        break;
      }
    }
  }
  return state.fullResponse;
}

export function handleMessage(
  userMessage: string,
  onChunk: (chunk: AgentChunk) => void,
  userId: string = "default",
): AgentHandle {
  const state = { fullResponse: "", aborted: false };
  let conversationRef: ReturnType<typeof query> | null = null;

  const promise = (async () => {
    const existingSessionId = sessions.get(userId);

    const options: Record<string, unknown> = {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: `
Jsi "Pepa" — back office asistent pro českou realitní firmu. Uživatel je tvůj šéf, ty jsi Pepa.
Odpovídej vždy česky. Databáze je v ${config.dataDir}/backoffice.db.
Vygenerované soubory ukládej do ${config.dataDir}/outputs/.
Dnešní datum: ${new Date().toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}.
Python s nainstalovanými knihovnami (openpyxl, pandas, python-pptx, reportlab, pypdf, python-docx, Pillow, matplotlib): ${config.projectRoot}/.venv/Scripts/python
PPTX prezentace: použij Node.js knihovnu pptxgenjs (globálně nainstalovaná). Ve skriptu importuj: const pptxgen = require('pptxgenjs');
NEINSTALUJ žádné Python ani npm balíčky — vše je již nainstalováno.
PŘIPOMÍNKY A OPAKOVANÉ ÚLOHY: NIKDY nepoužívej sleep, CronCreate ani jiné session-only nástroje. VŽDY zapiš task do ${config.dataDir}/scheduled-tasks/tasks.json — přečti soubor, přidej nový task, zapiš zpět. Server automaticky detekuje změny a spustí task v daný čas.
`,
      },
      cwd: config.projectRoot,
      settingSources: ["project"],
      tools: { type: "preset", preset: "claude_code" },
      allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Skill"],
      disallowedTools: ["CronCreate", "CronDelete", "CronList", "ToolSearch"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 25,
      maxBudgetUsd: 0.5,
    };

    if (existingSessionId) {
      options.resume = existingSessionId;
    }

    try {
      const conversation = query({ prompt: userMessage, options: options as any });
      conversationRef = conversation;
      await processConversation(conversation, userId, onChunk, state);

      if (!state.aborted) {
        onChunk({ type: "done", content: "" });
      }
    } catch (error) {
      if (state.aborted) return state.fullResponse;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Auto-retry without resume if session is stale/invalid/missing
      const isStaleSession = options.resume && (
        errorMsg.includes("No conversation found") ||
        errorMsg.includes("not a valid UUID") ||
        errorMsg.includes("--resume requires")
      );

      if (isStaleSession) {
        console.log(`[Agent] Stale session for ${userId}, retrying without resume`);
        sessions.delete(userId);
        const { resume: _, ...retryOptions } = options;
        state.fullResponse = "";

        try {
          const retryConversation = query({ prompt: userMessage, options: retryOptions as any });
          conversationRef = retryConversation;
          await processConversation(retryConversation, userId, onChunk, state);

          if (!state.aborted) {
            onChunk({ type: "done", content: "" });
          }
        } catch (retryError) {
          if (state.aborted) return state.fullResponse;
          const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
          onChunk({ type: "error", content: retryMsg });
          state.fullResponse = `Chyba: ${retryMsg}`;
        }
        return state.fullResponse;
      }

      // Non-retryable error
      if (sessions.get(userId)) {
        console.log(`[Agent] Clearing broken session for ${userId}`);
        sessions.delete(userId);
      }
      onChunk({ type: "error", content: errorMsg });
      state.fullResponse = `Chyba: ${errorMsg}`;
    }

    return state.fullResponse;
  })();

  const abort = () => {
    state.aborted = true;
    console.log(`[Agent] Aborting generation for ${userId}`);
    try {
      if (conversationRef && typeof (conversationRef as any).close === "function") {
        (conversationRef as any).close();
      }
    } catch {
      // Ignore close errors
    }
    onChunk({ type: "done", content: "" });
  };

  return { promise, abort };
}
