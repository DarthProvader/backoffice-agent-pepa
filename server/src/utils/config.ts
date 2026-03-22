import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramAllowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || "").split(",").filter(Boolean),
  webUrl: process.env.WEB_URL || "http://localhost:3000",
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, "../../../data"),
  projectRoot: path.resolve(__dirname, "../../../"),
};
