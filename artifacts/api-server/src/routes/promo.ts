import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, playersTable, transactionsTable, promoCodesTable, promoUsesTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/promo/redeem", async (req, res): Promise<void> => {
  const { telegramId, code } = req.body;
  if (!telegramId || !code) { res.status(400).json({ error: "telegramId va code kerak" }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(telegramId)));
  if (!player) { res.status(404).json({ error: "Foydalanuvchi topilmadi" }); return; }

  const [promo] = await db.select().from(promoCodesTable)
    .where(and(eq(promoCodesTable.code, String(code).toUpperCase()), eq(promoCodesTable.active, true)));
  if (!promo) { res.json({ success: false, error: "Noto'g'ri yoki eskirgan promo-kod" }); return; }
  if (promo.usedCount >= promo.maxUses) { res.json({ success: false, error: "Promo-kod limiti tugagan" }); return; }

  const alreadyUsed = await db.select().from(promoUsesTable)
    .where(and(eq(promoUsesTable.codeId, promo.id), eq(promoUsesTable.telegramId, String(telegramId))));
  if (alreadyUsed.length > 0) { res.json({ success: false, error: "Siz bu kodni allaqachon ishlatgansiz" }); return; }

  const newUsedCount = promo.usedCount + 1;
  const reachedLimit = newUsedCount >= promo.maxUses;
  await db.update(promoCodesTable)
    .set({ usedCount: newUsedCount, ...(reachedLimit ? { active: false } : {}) })
    .where(eq(promoCodesTable.id, promo.id));
  await db.insert(promoUsesTable).values({ codeId: promo.id, telegramId: String(telegramId) });
  const [updated] = await db.update(playersTable)
    .set({ balance: player.balance + promo.amount, updatedAt: new Date() })
    .where(eq(playersTable.telegramId, String(telegramId))).returning();
  await db.insert(transactionsTable).values({ playerId: player.id, type: "promo", amount: promo.amount, game: null });

  res.json({ success: true, amount: promo.amount, balance: updated.balance });
});

router.post("/promo/create", async (req, res): Promise<void> => {
  const { code, amount, maxUses } = req.body;
  if (!code || !amount) { res.status(400).json({ error: "code va amount kerak" }); return; }
  try {
    const [created] = await db.insert(promoCodesTable).values({
      code: String(code).toUpperCase(),
      amount: Number(amount),
      maxUses: Number(maxUses) || 1,
    }).returning();
    res.json({ success: true, promo: created });
  } catch {
    res.status(400).json({ error: "Bu kod allaqachon mavjud" });
  }
});

router.get("/promo/list", async (_req, res): Promise<void> => {
  const codes = await db.select().from(promoCodesTable).orderBy(promoCodesTable.createdAt);
  res.json(codes);
});

export default router;
