import { Bot, Context } from "grammy";
import { config } from "./utils/config.js";
import { handleMessage, AgentChunk } from "./agent.js";

let bot: Bot | null = null;

// Notification targets: pre-seeded from TELEGRAM_ALLOWED_USERS + dynamically added
const notifyChatIds = new Set<number>(
  config.telegramAllowedUsers.filter(Boolean).map(Number)
);

export function startTelegramBot() {
  if (!config.telegramBotToken) {
    console.log("[Telegram] No bot token configured, skipping");
    return;
  }

  bot = new Bot(config.telegramBotToken);

  // Middleware: check if user is allowed
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    if (
      config.telegramAllowedUsers.length > 0 &&
      !config.telegramAllowedUsers.includes(userId)
    ) {
      await ctx.reply("Nemáš oprávnění používat tohoto bota.");
      return;
    }

    // Track chat ID for notifications
    if (ctx.chat?.id) {
      notifyChatIds.add(ctx.chat.id);
    }

    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Ahoj! Jsem Pepa, tvůj back office asistent. 🏠\n\n" +
        "Zeptej se mě na cokoliv — klienty, nemovitosti, leady, reporty.\n\n" +
        "Příklady:\n" +
        "• Jaké nové klienty máme za Q1?\n" +
        "• Které nemovitosti mají chybějící data?\n" +
        "• Sleduj nabídky v Holešovicích každé ráno v 7:00"
    );
  });

  // /clear command — reset conversation
  bot.command("clear", async (ctx) => {
    const { clearSession } = await import("./agent.js");
    const userId = `telegram-${ctx.from!.id}`;
    clearSession(userId);
    await ctx.reply("Konverzace vymazána. Můžeme začít znovu.");
  });

  // Handle all text messages
  bot.on("message:text", async (ctx) => {
    const userId = `telegram-${ctx.from!.id}`;
    const userMessage = ctx.message.text;

    // Send "typing" indicator
    await ctx.replyWithChatAction("typing");

    // Collect response chunks — we'll send the final text, not stream
    let fullResponse = "";
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);

    try {
      fullResponse = await handleMessage(
        userMessage,
        (_chunk: AgentChunk) => {
          // We don't stream to Telegram — just collect
        },
        userId
      );

      clearInterval(typingInterval);

      if (!fullResponse.trim()) {
        fullResponse = "Hotovo, ale nemám co odpovědět.";
      }

      // Telegram has 4096 char limit — split if needed
      await sendLongMessage(ctx, fullResponse);
    } catch (error) {
      clearInterval(typingInterval);
      const errorMsg = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Chyba: ${errorMsg}`);
    }
  });

  bot.start({
    onStart: () => {
      console.log("[Telegram] Bot started");
    },
  });

  // Graceful stop
  process.once("SIGINT", () => bot?.stop());
  process.once("SIGTERM", () => bot?.stop());
}

/** Send a notification to all allowed users */
export async function sendNotification(message: string) {
  if (!bot) return;

  for (const chatId of notifyChatIds) {
    try {
      await sendLongMessageById(chatId, message);
    } catch (error) {
      console.error(`[Telegram] Failed to send to ${chatId}:`, error);
    }
  }
}

/** Split long messages for Telegram's 4096 char limit */
async function sendLongMessage(ctx: Context, text: string) {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(async () => {
      // Markdown parse failed — send as plain text
      await ctx.reply(chunk);
    });
  }
}

async function sendLongMessageById(chatId: number, text: string) {
  if (!bot) return;
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    await bot.api.sendMessage(chatId, chunk, { parse_mode: "Markdown" }).catch(async () => {
      await bot!.api.sendMessage(chatId, chunk);
    });
  }
}

function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at newline
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) {
      // No good newline — split at space
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt < maxLen / 2) {
      // No good space — hard split
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}
