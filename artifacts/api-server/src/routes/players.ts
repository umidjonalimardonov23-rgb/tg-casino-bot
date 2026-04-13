import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, playersTable, transactionsTable, withdrawRequestsTable, depositRequestsTable } from "@workspace/db";
import {
  SyncPlayerBody,
  GetPlayerParams,
  DepositParams,
  DepositBody,
  WithdrawParams,
  WithdrawBody,
  PlaceBetParams,
  PlaceBetBody,
  GetTransactionsParams,
} from "@workspace/api-zod";
import { notifyAdminWithdraw } from "../bot";

const router: IRouter = Router();

router.post("/players/sync", async (req, res): Promise<void> => {
  const parsed = SyncPlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { telegramId, username, firstName, lastName, photoUrl } = parsed.data;
  const existing = await db.select().from(playersTable).where(eq(playersTable.telegramId, telegramId));
  if (existing.length > 0) {
    const [updated] = await db.update(playersTable)
      .set({ username: username ?? null, firstName, lastName: lastName ?? null, photoUrl: photoUrl ?? null, updatedAt: new Date() })
      .where(eq(playersTable.telegramId, telegramId))
      .returning();
    res.json(formatPlayer(updated));
    return;
  }
  const [created] = await db.insert(playersTable)
    .values({ telegramId, username: username ?? null, firstName, lastName: lastName ?? null, photoUrl: photoUrl ?? null, balance: 0 })
    .returning();
  res.json(formatPlayer(created));
});

router.get("/players/:telegramId", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, params.data.telegramId));
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(formatPlayer(player));
});

router.post("/players/:telegramId/deposit", async (req, res): Promise<void> => {
  const params = DepositParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = DepositBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, params.data.telegramId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const newBalance = player.balance + body.data.amount;
  const [updated] = await db.update(playersTable)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(playersTable.telegramId, params.data.telegramId))
    .returning();

  await db.insert(transactionsTable).values({
    playerId: player.id,
    type: "deposit",
    amount: body.data.amount,
    game: null,
  });

  res.json(formatPlayer(updated));
});

router.post("/players/:telegramId/deposit-request", async (req, res): Promise<void> => {
  const params = DepositParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = DepositBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, params.data.telegramId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const bonus = Math.floor(body.data.amount * 0.2);
  const [req2] = await db.insert(depositRequestsTable).values({
    playerId: player.id,
    telegramId: params.data.telegramId,
    amount: body.data.amount,
    bonusAmount: bonus,
  }).returning();

  // Notify user via bot to send receipt
  try {
    const { notifyUserDepositCreated } = await import("../bot");
    await notifyUserDepositCreated(params.data.telegramId, body.data.amount, bonus);
  } catch { /* bot not available in dev */ }

  res.json({ ok: true, requestId: req2.id, amount: body.data.amount, bonus });
});

router.post("/players/:telegramId/withdraw", async (req, res): Promise<void> => {
  const params = WithdrawParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = WithdrawBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const amount = body.data.amount;
  const cardNumber: string = typeof req.body.cardNumber === "string" ? req.body.cardNumber : "";
  const cardHolder: string = typeof req.body.cardHolder === "string" ? req.body.cardHolder : "";

  const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, params.data.telegramId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  if (player.balance < amount) {
    res.status(400).json({ error: "Balans yetarli emas" });
    return;
  }

  const newBalance = player.balance - amount;
  const [updated] = await db.update(playersTable)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(playersTable.telegramId, params.data.telegramId))
    .returning();

  await db.insert(transactionsTable).values({
    playerId: player.id,
    type: "withdraw",
    amount,
    game: null,
  });

  const card = cardNumber || "—";
  const holder = cardHolder || "—";
  const [req2] = await db.insert(withdrawRequestsTable).values({
    playerId: player.id,
    telegramId: params.data.telegramId,
    amount,
    cardNumber: card,
    cardHolder: holder,
  }).returning();

  notifyAdminWithdraw({
    reqId: req2.id,
    telegramId: params.data.telegramId,
    firstName: player.firstName,
    username: player.username,
    amount,
    cardNumber: card,
    cardHolder: holder,
  }).catch(() => {});

  res.json(formatPlayer(updated));
});

router.post("/players/:telegramId/bet", async (req, res): Promise<void> => {
  const params = PlaceBetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = PlaceBetBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, params.data.telegramId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  if (player.balance < body.data.amount) {
    res.status(400).json({ error: "Balans yetarli emas" });
    return;
  }

  const { amount, game, won, winAmount } = body.data;
  let newBalance: number;
  let netChange: number;

  if (won) {
    netChange = winAmount - amount;
    newBalance = player.balance - amount + winAmount;
  } else {
    netChange = -amount;
    newBalance = player.balance - amount;
  }

  const [updated] = await db.update(playersTable)
    .set({
      balance: newBalance,
      totalWon: won ? player.totalWon + winAmount : player.totalWon,
      totalLost: !won ? player.totalLost + amount : player.totalLost,
      gamesPlayed: player.gamesPlayed + 1,
      totalWagered: player.totalWagered + amount,
      updatedAt: new Date(),
    })
    .where(eq(playersTable.telegramId, params.data.telegramId))
    .returning();

  await db.insert(transactionsTable).values({
    playerId: player.id,
    type: won ? "win" : "loss",
    amount: won ? winAmount : amount,
    game: game ?? null,
  });

  res.json({ balance: updated.balance, won, winAmount, netChange });
});

router.get("/players/:telegramId/transactions", async (req, res): Promise<void> => {
  const params = GetTransactionsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, params.data.telegramId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const txs = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.playerId, player.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  res.json(txs.map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    game: t.game,
    createdAt: t.createdAt.toISOString(),
  })));
});

function formatPlayer(p: typeof playersTable.$inferSelect) {
  return {
    id: p.id,
    telegramId: p.telegramId,
    username: p.username,
    firstName: p.firstName,
    lastName: p.lastName,
    photoUrl: p.photoUrl,
    balance: p.balance,
    totalWon: p.totalWon,
    totalLost: p.totalLost,
    gamesPlayed: p.gamesPlayed,
    totalDeposited: p.totalDeposited,
    wagerRequirement: p.wagerRequirement,
    totalWagered: p.totalWagered,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export default router;
