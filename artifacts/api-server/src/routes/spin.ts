import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";

const router: IRouter = Router();

const FREE_PRIZES  = [0, 0, 0, 0, 0, 500, 500, 1000, 2000, 5000];
const PAID_PRIZES  = [0, 0, 0, 500, 500, 1000, 1000, 2000, 3000, 5000];

const SYMBOL_MAP: Record<number, string> = {
  5000: "💎", 3000: "⭐", 2000: "⭐", 1000: "🌟", 500: "🍒",
};

router.get("/spin/status/:telegramId", async (req, res): Promise<void> => {
  const [player] = await db.select().from(playersTable)
    .where(eq(playersTable.telegramId, req.params.telegramId));
  if (!player) { res.status(404).json({ error: "not_found" }); return; }

  const canSpin = !player.lastSpinAt
    || Date.now() - new Date(player.lastSpinAt).getTime() >= 24 * 60 * 60 * 1000;
  const nextSpinAt = player.lastSpinAt && !canSpin
    ? new Date(new Date(player.lastSpinAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;

  res.json({ canSpin, nextSpinAt, balance: player.balance });
});

router.post("/spin", async (req, res): Promise<void> => {
  const { telegramId, paid } = req.body;
  if (!telegramId) { res.status(400).json({ error: "missing_id" }); return; }

  const [player] = await db.select().from(playersTable)
    .where(eq(playersTable.telegramId, String(telegramId)));
  if (!player) { res.status(404).json({ error: "not_found" }); return; }

  const now = new Date();

  if (!paid) {
    // FREE spin — check 24h cooldown
    if (player.lastSpinAt) {
      const diffMs = Date.now() - new Date(player.lastSpinAt).getTime();
      if (diffMs < 24 * 60 * 60 * 1000) {
        const nextSpinAt = new Date(
          new Date(player.lastSpinAt).getTime() + 24 * 60 * 60 * 1000
        ).toISOString();
        res.status(429).json({ error: "cooldown", nextSpinAt });
        return;
      }
    }
    const prize = FREE_PRIZES[Math.floor(Math.random() * FREE_PRIZES.length)];
    const symbol = prize > 0 ? (SYMBOL_MAP[prize] ?? "🍒") : "💣";
    const nextSpinAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    await db.update(playersTable).set({
      lastSpinAt: now,
      balance: player.balance + prize,
      totalWon: prize > 0 ? player.totalWon + prize : player.totalWon,
      updatedAt: now,
    }).where(eq(playersTable.telegramId, String(telegramId)));

    res.json({ prize, symbol, nextSpinAt });
    return;
  }

  // PAID spin — cost 2000 UZS, no cooldown
  const COST = 2000;
  if (player.balance < COST) {
    res.status(400).json({ error: "insufficient_balance" });
    return;
  }

  const prize = PAID_PRIZES[Math.floor(Math.random() * PAID_PRIZES.length)];
  const symbol = prize > 0 ? (SYMBOL_MAP[prize] ?? "🍒") : "💣";
  const net = prize - COST;

  await db.update(playersTable).set({
    balance: player.balance - COST + prize,
    totalWon: prize > 0 ? player.totalWon + prize : player.totalWon,
    totalWagered: player.totalWagered + COST,
    gamesPlayed: player.gamesPlayed + 1,
    updatedAt: now,
  }).where(eq(playersTable.telegramId, String(telegramId)));

  res.json({ prize, symbol, net, nextSpinAt: null });
});

export default router;
