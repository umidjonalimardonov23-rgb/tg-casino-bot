import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { handleWebhookUpdate, getBotStatus } from "./bot";

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
  res.json({ status: "ok", version: "d31e6d0-v2", ...getBotStatus() });
});

app.post("/api/bot-webhook", async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  const chatId = body?.message?.chat?.id || body?.callback_query?.message?.chat?.id;
  const bodyStr = JSON.stringify(body || null).slice(0, 200);
  logger.info({ chatId, bodyStr }, "WEBHOOK RAW");
  if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `🔍 Debug: ${bodyStr.slice(0, 100)}` })
      });
    } catch {}
  }
  try {
    await handleWebhookUpdate(body);
  } catch (err) {
    logger.error({ err }, "webhook handler error");
    if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: `❌ Error: ${err instanceof Error ? err.message : String(err)}` })
        });
      } catch {}
    }
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
