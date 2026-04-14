import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { handleWebhookUpdate, getBotStatus, testSendMessage } from "./bot";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "fix-v5", ...getBotStatus() });
});

app.get("/api/db-fix", async (_req, res) => {
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    // Add missing column if not exists
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS last_menu_msg_id INTEGER`);
    // Clear lastMenuMsgId for all (reset to avoid old broken IDs)
    await db.execute(sql`UPDATE players SET last_menu_msg_id = NULL`);
    // Check columns
    const cols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='players' ORDER BY column_name`);
    res.json({ ok: true, columns: (cols as any).rows?.map((r: any) => r.column_name) || cols });
  } catch (err: any) {
    res.json({ ok: false, error: err?.message });
  }
});

app.get("/api/test-send", async (req, res) => {
  const chatId = Number(req.query.chatId || process.env.ADMIN_TELEGRAM_ID || "0");
  const result = await testSendMessage(chatId);
  res.json(result);
});

app.post("/api/bot-webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    await handleWebhookUpdate(req.body);
  } catch (err) {
    logger.error({ err }, "webhook handler error");
  }
});

app.use("/api", router);

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  const staticPath = path.resolve(__dirname, "../../tg-game/dist/public");
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
    logger.info({ staticPath }, "Serving frontend static files");
  } else {
    logger.warn({ staticPath }, "Frontend static files not found");
  }
}


export default app;
