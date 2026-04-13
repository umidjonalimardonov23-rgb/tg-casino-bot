import TelegramBot from "node-telegram-bot-api";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { db, playersTable, depositRequestsTable, withdrawRequestsTable, promoCodesTable } from "@workspace/db";
import { logger } from "./lib/logger";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHANNEL_INVITE = process.env.CHANNEL_INVITE || "https://t.me/+BIxGcXiUhIc5MWJi";
const CHANNEL_ID = process.env.CHANNEL_ID || "";
const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID || "0");
const CARD_NUMBER = process.env.CARD_NUMBER || "";
const CARD_HOLDER = process.env.CARD_HOLDER || "";
const DOMAINS = process.env.REPLIT_DOMAINS || "";
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "";
const RAILWAY_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || "";
const APP_URL =
  process.env.APP_URL ||
  RENDER_URL ||
  (RAILWAY_DOMAIN ? `https://${RAILWAY_DOMAIN}` : "") ||
  (DOMAINS ? `https://${DOMAINS.split(",")[0]}` : "");
const BONUS_PERCENT = 20;

let bot: TelegramBot | null = null;
const waitingForCheck = new Map<number, number>();             // userId -> depositRequestId
const waitingForAmount = new Set<number>();                    // userId waiting to type deposit amount
const waitingForWithdrawAmount = new Set<number>();            // userId waiting to type withdraw amount
const pendingWithdraw = new Map<number, { amount: number }>(); // userId -> withdraw info
const waitingForHelp = new Set<number>();                      // userId waiting to type help question
const adminReplyTarget = new Map<number, number>();            // adminId -> targetUserId (for admin replies)
const waitingForBroadcast = new Set<number>();                  // adminId waiting to type broadcast message
const waitingForSendId = new Set<number>();                    // admin waiting to type target userId
const waitingForSendMsg = new Map<number, string>();           // admin -> targetId (waiting for message text)
const waitingForAddbalId = new Set<number>();                  // admin waiting to type userId for balance
const waitingForAddbalAmount = new Map<number, string>();      // admin -> targetId (waiting for amount)
const waitingForBanId = new Set<number>();                     // admin waiting to type userId for ban/unban
const waitingForPromoCode = new Set<number>();                 // admin waiting to type promo code name
const waitingForPromoAmount = new Map<number, string>();       // admin -> code (waiting for amount)
const waitingForPromoMaxUses = new Map<number, { code: string; amount: number }>(); // admin -> {code,amount}

export async function notifyAdminWithdraw(opts: {
  reqId: number; telegramId: string; firstName: string; username: string | null;
  amount: number; cardNumber: string; cardHolder: string;
}) {
  if (!bot || !ADMIN_ID) return;
  try {
    await bot.sendMessage(ADMIN_ID,
      `💸 <b>PUL YECHISH SO'ROVI (WEB)</b>\n\n` +
      `👤 ${opts.firstName} (@${opts.username ?? "—"})\n` +
      `🆔 <code>${opts.telegramId}</code>\n` +
      `💵 Miqdor: <b>${fmt(opts.amount)} UZS</b>\n` +
      `💳 Karta: <code>${opts.cardNumber}</code>\n` +
      `👤 Egasi: ${opts.cardHolder}`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
        { text: "✅ To'landi", callback_data: `wd_ok_${opts.reqId}` },
        { text: "❌ Rad", callback_data: `wd_no_${opts.reqId}` },
      ]]}}
    );
  } catch (err) {
    logger.error({ err }, "notifyAdminWithdraw xato");
  }
}

function fmt(n: number) { return n.toLocaleString("uz-UZ"); }

async function checkSub(userId: number): Promise<boolean> {
  if (!bot || !CHANNEL_ID) return true;
  try {
    const m = await bot.getChatMember(CHANNEL_ID, userId);
    return ["member","administrator","creator"].includes(m.status);
  } catch { return true; }
}

async function getOrCreatePlayer(tgUser: TelegramBot.User) {
  const [p] = await db.insert(playersTable)
    .values({
      telegramId: String(tgUser.id),
      username: tgUser.username ?? null,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name ?? null,
      balance: 0,
    })
    .onConflictDoUpdate({
      target: playersTable.telegramId,
      set: { username: tgUser.username ?? null, firstName: tgUser.first_name, updatedAt: new Date() },
    })
    .returning();
  return p;
}

const DEPOSIT_URL = APP_URL.endsWith("/") ? `${APP_URL}deposit` : `${APP_URL}/deposit`;

// Track last main menu message ID per user so /start edits it instead of sending new
const userMenuMsgId = new Map<number, number>();

function mainMenuKeyboard(isAdmin: boolean): any[][] {
  const kb: any[][] = [
    [{ text: "🎮 O'YINNI BOSHLASH", web_app: { url: APP_URL } }],
    [{ text: "💰 Balansim", callback_data: "balance" }, { text: "📖 Qoidalar", callback_data: "howto" }],
    [{ text: "➕ Hisob To'ldirish", callback_data: "deposit_menu" }, { text: "💸 Pul Yechish", callback_data: "withdraw_menu" }],
    [{ text: "👥 Referal", callback_data: "referral_menu" }, { text: "❓ Yordam", callback_data: "help_menu" }],
  ];
  if (isAdmin) kb.push([{ text: "🔧 ADMIN PANEL", callback_data: "admin_panel" }]);
  return kb;
}

function mainMenuText(name: string, balance: number): string {
  return `🎮 <b>Salom, ${name}!</b>\n\n💰 Balansingiz: <b>${fmt(balance)} UZS</b>\n\n👇 O'yinni boshlash uchun tugmani bosing:`;
}

async function mainMenu(chatId: number, name: string, balance: number, isAdmin = false) {
  // Remove any lingering reply keyboard first
  try {
    const rm = await bot!.sendMessage(chatId, "⌛", { reply_markup: { remove_keyboard: true } });
    await bot!.deleteMessage(chatId, rm.message_id);
  } catch {}
  const sent = await bot!.sendMessage(chatId, mainMenuText(name, balance),
    { parse_mode: "HTML", reply_markup: { inline_keyboard: mainMenuKeyboard(isAdmin) }}
  );
  userMenuMsgId.set(chatId, sent.message_id);
}

async function editToMainMenu(chatId: number, msgId: number, name: string, balance: number, isAdmin = false) {
  try {
    await bot!.editMessageText(mainMenuText(name, balance), {
      chat_id: chatId, message_id: msgId,
      parse_mode: "HTML", reply_markup: { inline_keyboard: mainMenuKeyboard(isAdmin) }
    });
    userMenuMsgId.set(chatId, msgId);
  } catch { /* message unchanged or deleted — ignore */ }
}

export async function notifyUserDepositCreated(telegramId: string, amount: number, bonus: number) {
  if (!bot) return;
  try {
    await bot.sendMessage(Number(telegramId),
      `✅ <b>Depozit so'rovi qabul qilindi!</b>\n\n` +
      `💵 Miqdor: <b>${fmt(amount)} UZS</b>\n` +
      `🎁 Bonus: <b>+${fmt(bonus)} UZS</b>\n` +
      `💰 Jami: <b>${fmt(amount + bonus)} UZS</b>\n\n` +
      `📸 <b>Endi to'lov cheki (screenshot) rasmini shu yerga yuboring.</b>\n` +
      `Admin tasdiqlashini kuting.`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    logger.error({ err }, "notifyUserDepositCreated xato");
  }
}

async function sendDepositCard(chatId: number, amount: number, userId: number) {
  const rows = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(userId)));
  if (!rows.length) return;
  const p = rows[0];
  const bonus = Math.floor(amount * BONUS_PERCENT / 100);
  const [req] = await db.insert(depositRequestsTable).values({
    playerId: p.id, telegramId: String(userId), amount, bonusAmount: bonus,
  }).returning();
  waitingForCheck.set(userId, req.id);

  await bot!.sendMessage(chatId,
    `💳 <b>To'lov Ma'lumotlari</b>\n\n` +
    `💵 To'lash miqdori: <b>${fmt(amount)} UZS</b>\n` +
    `🎁 Bonus: <b>+${fmt(bonus)} UZS</b>\n` +
    `💰 Hisobga tushadi: <b>${fmt(amount + bonus)} UZS</b>\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💳 Karta: <code>${CARD_NUMBER}</code>\n` +
    `👤 ${CARD_HOLDER}\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `✅ Pul o'tkazganingizdan so'ng, <b>chek rasmini</b> shu yerga yuboring!`,
    { parse_mode: "HTML" }
  );
}

export function processWebhookUpdate(body: object) {
  if (!bot) return;
  bot.processUpdate(body as any);
}

export async function startBot() {
  if (!TOKEN) { logger.warn("No BOT TOKEN"); return; }

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && APP_URL) {
    const webhookUrl = `${APP_URL}/api/bot-webhook`;
    bot = new TelegramBot(TOKEN, { webHook: false });
    await bot.setWebHook(webhookUrl);
    logger.info({ webhookUrl }, "Bot started (webhook mode)");
  } else {
    // Development — start polling (clear any old webhook first)
    bot = new TelegramBot(TOKEN, { polling: false });
    await bot.deleteWebHook();
    await bot.startPolling();
    logger.info("Bot started (polling mode — development)");
  }

  // Set bot commands (shows in command list when user types /)
  try {
    await bot.setMyCommands([
      { command: "start", description: "🎮 Botni ishga tushirish" },
      { command: "menu",  description: "📋 Asosiy menyu" },
      { command: "help",  description: "❓ Yordam" },
    ]);
  } catch {}

  // Set persistent menu button (bottom-left button in chat — opens mini app directly)
  if (APP_URL) {
    try {
      await fetch(`https://api.telegram.org/bot${TOKEN}/setChatMenuButton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_button: { type: "web_app", text: "🎮 O'YIN", web_app: { url: APP_URL } }
        }),
      });
    } catch {}
  }

  // /start command (with referral support)
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const user = msg.from; if (!user) return;
    const isNew = !(await db.select().from(playersTable).where(eq(playersTable.telegramId, String(user.id)))).length;
    const player = await getOrCreatePlayer(user);

    // Handle referral code
    const param = (match?.[1] || "").trim();
    if (isNew && param.startsWith("ref_")) {
      const referrerId = param.replace("ref_", "");
      if (referrerId !== String(user.id)) {
        const [referrer] = await db.select().from(playersTable).where(eq(playersTable.telegramId, referrerId));
        if (referrer) {
          await db.update(playersTable).set({ referredBy: referrerId, updatedAt: new Date() }).where(eq(playersTable.telegramId, String(user.id)));
          await db.update(playersTable).set({ balance: referrer.balance + 1000, referralCount: referrer.referralCount + 1, updatedAt: new Date() }).where(eq(playersTable.telegramId, referrerId));
          try {
            await bot!.sendMessage(Number(referrerId),
              `🎉 <b>Referal bonus!</b>\n\n👤 ${user.first_name} siz orqali ro'yxatdan o'tdi!\n💰 <b>+1 000 UZS</b> balansingizga qo'shildi!`,
              { parse_mode: "HTML" }
            );
          } catch {}
        }
      }
    }

    // Check channel subscription (one-time, saved in DB)
    const [freshPlayer] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(user.id)));
    if (!freshPlayer?.channelVerified) {
      await bot!.sendMessage(msg.chat.id,
        `🎮 <b>1X GAME Botga Xush Kelibsiz!</b>\n\n📢 O'yin o'ynash uchun avval bizning kanalga a'zo bo'ling:\n\n👇 Quyidagi tugmani bosib a'zo bo'ling, so'ng <b>✅ A'zo Bo'ldim</b> tugmasini bosing.`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: "📢 Kanalga A'zo Bo'lish", url: CHANNEL_INVITE }],
          [{ text: "✅ A'zo Bo'ldim", callback_data: "check_sub" }],
        ]}}
      );
      return;
    }
    const isAdminUser = !ADMIN_ID || user.id === ADMIN_ID;
    const existingMsgId = userMenuMsgId.get(msg.chat.id);
    if (existingMsgId) {
      // Try to edit the existing menu — if it fails (too old/deleted), send a new one
      try {
        await bot!.editMessageText(mainMenuText(user.first_name, freshPlayer.balance), {
          chat_id: msg.chat.id, message_id: existingMsgId,
          parse_mode: "HTML", reply_markup: { inline_keyboard: mainMenuKeyboard(isAdminUser) }
        });
        userMenuMsgId.set(msg.chat.id, existingMsgId);
        return;
      } catch { /* message too old or deleted — fall through to send new */ }
    }
    await mainMenu(msg.chat.id, user.first_name, freshPlayer.balance, isAdminUser);
  });

  // Admin panel helper
  async function sendAdminMenu(chatId: number) {
    try {
      logger.info({ chatId }, "sendAdminMenu called");
      const depRes = await db.execute(sql`SELECT count(*)::int as cnt FROM deposit_requests WHERE status='pending'`);
      const wdRes = await db.execute(sql`SELECT count(*)::int as cnt FROM withdraw_requests WHERE status='pending'`);
      const playersRes = await db.execute(sql`SELECT count(*)::int as cnt FROM players`);
      const depCount = Number((depRes.rows?.[0] as any)?.cnt ?? (depRes as any)[0]?.cnt ?? 0);
      const wdCount = Number((wdRes.rows?.[0] as any)?.cnt ?? (wdRes as any)[0]?.cnt ?? 0);
      const totalPlayers = Number((playersRes.rows?.[0] as any)?.cnt ?? (playersRes as any)[0]?.cnt ?? 0);
      logger.info({ depCount, wdCount, totalPlayers }, "sendAdminMenu stats loaded");
      await bot!.sendMessage(chatId,
        `🔧 <b>ADMIN PANEL</b>\n\n` +
        `👥 Jami o'yinchilar: <b>${totalPlayers}</b>\n` +
        `⏳ Kutilayotgan depozit: <b>${depCount} ta</b>\n` +
        `⏳ Kutilayotgan yechim: <b>${wdCount} ta</b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📢 Barchaga xabar", callback_data: "admin_broadcast" },
                { text: "💌 Bitta kishiga", callback_data: "admin_send_user" },
              ],
              [
                { text: "💰 Bonus/Balans qo'sh", callback_data: "admin_addbal" },
                { text: "📊 Statistika", callback_data: "admin_stat" },
              ],
              [
                { text: "👥 Foydalanuvchilar", callback_data: "admin_users" },
                { text: "⏳ Kutilayotganlar", callback_data: "admin_pending" },
              ],
              [
                { text: "💸 Yechimlarni ko'r", callback_data: "admin_withdrawals" },
              ],
              [
                { text: "🚫 Ban / Unban", callback_data: "admin_ban" },
                { text: "🎫 Promo Kodlar", callback_data: "admin_promo" },
              ],
            ],
          },
        }
      );
    } catch (err) {
      logger.error({ err }, "sendAdminMenu xato");
      try {
        await bot!.sendMessage(chatId, `❌ Admin panel xatosi: ${err instanceof Error ? err.message : String(err)}`);
      } catch {}
    }
  }

  // /menu command — show main menu
  bot.onText(/\/menu/, async (msg) => {
    if (!msg.from) return;
    const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(msg.from.id)));
    if (!p) { await bot!.sendMessage(msg.chat.id, "Botni ishga tushirish uchun /start yuboring."); return; }
    const isAdminUser = !ADMIN_ID || msg.from.id === ADMIN_ID;
    await mainMenu(msg.chat.id, msg.from.first_name, p.balance, isAdminUser);
  });

  // /help command
  bot.onText(/\/help/, async (msg) => {
    if (!msg.from) return;
    await bot!.sendMessage(msg.chat.id,
      `❓ <b>Yordam</b>\n\nSavolingizni yozing, admin tez orada javob beradi:`,
      { parse_mode: "HTML" }
    );
  });

  // /admin command — admin panel
  bot.onText(/\/admin/, async (msg) => {
    if (!msg.from) return;
    if (ADMIN_ID && msg.from.id !== ADMIN_ID) return;
    await sendAdminMenu(msg.chat.id);
  });

  // /broadcast command — admin only
  bot.onText(/\/broadcast/, async (msg) => {
    if (msg.from?.id !== ADMIN_ID) return;
    waitingForBroadcast.add(ADMIN_ID);
    await bot!.sendMessage(msg.chat.id,
      `📢 <b>Xabar Yuborish</b>\n\nBarcha o'yinchilarga yuboriladigan xabarni yozing:\n\n<i>Bekor qilish uchun /cancel yozing</i>`,
      { parse_mode: "HTML" }
    );
  });

  // /stat command — admin only
  bot.onText(/\/stat/, async (msg) => {
    if (msg.from?.id !== ADMIN_ID) return;
    const chatId = msg.chat.id;
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [totalPlayers] = await db.select({ count: sql<number>`count(*)::int` }).from(playersTable);
      const [newToday] = await db.select({ count: sql<number>`count(*)::int` }).from(playersTable).where(sql`created_at >= ${today}`);
      const [depToday] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::int`, cnt: sql<number>`count(*)::int` }).from(depositRequestsTable).where(sql`created_at >= ${today} and status = 'approved'`);
      const [wdToday] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::int`, cnt: sql<number>`count(*)::int` }).from(withdrawRequestsTable).where(sql`created_at >= ${today} and status = 'approved'`);
      const [totalBal] = await db.select({ total: sql<number>`coalesce(sum(balance),0)::int` }).from(playersTable);
      const pendingDeps = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.status, "pending"));
      const pendingWds = await db.select().from(withdrawRequestsTable).where(eq(withdrawRequestsTable.status, "pending"));

      await bot!.sendMessage(chatId,
        `📊 <b>KUNLIK STATISTIKA</b>\n\n` +
        `👥 Jami o'yinchilar: <b>${totalPlayers.count}</b>\n` +
        `🆕 Bugun yangi: <b>${newToday.count}</b>\n\n` +
        `💰 Bugun depozit: <b>${fmt(depToday.total)} UZS</b> (${depToday.cnt} ta)\n` +
        `💸 Bugun yechim: <b>${fmt(wdToday.total)} UZS</b> (${wdToday.cnt} ta)\n\n` +
        `🏦 Jami balanslar: <b>${fmt(totalBal.total)} UZS</b>\n\n` +
        `⏳ Kutilayotgan:\n• Depozit: <b>${pendingDeps.length} ta</b>\n• Yechim: <b>${pendingWds.length} ta</b>`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.error({ err }, "stat xato");
      await bot!.sendMessage(chatId, "❌ Statistika yuklanmadi.");
    }
  });

  // /send <telegramId> <message> — admin only
  bot.onText(/\/send (.+)/, async (msg, match) => {
    if (msg.from?.id !== ADMIN_ID) return;
    const parts = (match?.[1] || "").trim().split(" ");
    const targetId = parts[0];
    const text = parts.slice(1).join(" ");
    if (!targetId || !text) {
      await bot!.sendMessage(msg.chat.id, "❌ Format: /send <telegramId> <xabar matni>");
      return;
    }
    try {
      await bot!.sendMessage(Number(targetId),
        `📩 <b>Admin xabari:</b>\n\n${text}`,
        { parse_mode: "HTML" }
      );
      await bot!.sendMessage(msg.chat.id, `✅ Xabar <b>${targetId}</b> ga yuborildi.`, { parse_mode: "HTML" });
    } catch {
      await bot!.sendMessage(msg.chat.id, `❌ Xabar yuborib bo'lmadi. ID: <b>${targetId}</b>`, { parse_mode: "HTML" });
    }
  });

  // /users — list all players (admin only)
  bot.onText(/\/users/, async (msg) => {
    if (msg.from?.id !== ADMIN_ID) return;
    const all = await db.select({
      telegramId: playersTable.telegramId,
      firstName: playersTable.firstName,
      username: playersTable.username,
      balance: playersTable.balance,
    }).from(playersTable).orderBy(playersTable.createdAt);

    const lines = all
      .filter(p => p.telegramId !== "demo_user")
      .map(p => {
        const name = p.username ? `@${p.username}` : p.firstName;
        return `👤 ${name}\n🆔 <code>${p.telegramId}</code>\n💰 ${fmt(p.balance)} UZS`;
      }).join("\n\n");

    await bot!.sendMessage(msg.chat.id,
      `👥 <b>FOYDALANUVCHILAR (${all.length - 1} ta)</b>\n\n${lines || "Hali hech kim yo'q"}`,
      { parse_mode: "HTML" }
    );
  });

  // /addbal <telegramId> <amount> — admin only
  bot.onText(/\/addbal (.+)/, async (msg, match) => {
    if (msg.from?.id !== ADMIN_ID) return;
    const parts = (match?.[1] || "").trim().split(" ");
    const targetId = parts[0];
    const amount = Number(parts[1]);
    if (!targetId || !amount || isNaN(amount) || amount <= 0) {
      await bot!.sendMessage(msg.chat.id, "❌ Format: /addbal <telegramId> <miqdor>\nMasalan: /addbal 123456789 50000");
      return;
    }
    const [player] = await db.select().from(playersTable).where(eq(playersTable.telegramId, targetId));
    if (!player) {
      await bot!.sendMessage(msg.chat.id, `❌ Foydalanuvchi topilmadi: <b>${targetId}</b>`, { parse_mode: "HTML" });
      return;
    }
    const newBal = player.balance + amount;
    await db.update(playersTable).set({ balance: newBal, updatedAt: new Date() }).where(eq(playersTable.telegramId, targetId));
    const name = player.username ? `@${player.username}` : player.firstName;
    await bot!.sendMessage(msg.chat.id,
      `✅ <b>Balans qo'shildi!</b>\n\n👤 Foydalanuvchi: ${name}\n💰 Qo'shildi: <b>+${fmt(amount)} UZS</b>\n💵 Yangi balans: <b>${fmt(newBal)} UZS</b>`,
      { parse_mode: "HTML" }
    );
    try {
      await bot!.sendMessage(Number(targetId),
        `🎁 <b>Balansingizga pul qo'shildi!</b>\n\n💰 <b>+${fmt(amount)} UZS</b>\n💵 Yangi balans: <b>${fmt(newBal)} UZS</b>`,
        { parse_mode: "HTML" }
      );
    } catch {}
  });

  // Photo handler — deposit receipt
  bot.on("photo", async (msg) => {
    const userId = msg.from?.id; if (!userId) return;
    const fileId = msg.photo![msg.photo!.length - 1].file_id;

    // First try in-memory map; fallback to DB lookup (handles server restarts)
    let reqId = waitingForCheck.get(userId);
    if (!reqId) {
      const pending = await db.select().from(depositRequestsTable)
        .where(and(
          eq(depositRequestsTable.telegramId, String(userId)),
          eq(depositRequestsTable.status, "pending"),
          isNull(depositRequestsTable.telegramFileId),
        ))
        .orderBy(depositRequestsTable.createdAt)
        .limit(1);
      if (!pending.length) return;
      reqId = pending[0].id;
    }

    await db.update(depositRequestsTable).set({ telegramFileId: fileId }).where(eq(depositRequestsTable.id, reqId));
    waitingForCheck.delete(userId);

    const [req] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, reqId));
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, req.playerId));

    await bot!.sendMessage(msg.chat.id, `✅ <b>Chekingiz qabul qilindi!</b>\n\n⏳ Admin tekshirib, ${BONUS_PERCENT}% bonus bilan balansingizni to'ldiradi.`, { parse_mode: "HTML" });

    if (ADMIN_ID) {
      try {
        await bot!.sendPhoto(ADMIN_ID, fileId, {
          caption:
            `💳 <b>YANGI DEPOZIT SO'ROVI</b>\n\n` +
            `👤 ${player.firstName} (@${player.username ?? "—"})\n` +
            `🆔 <code>${player.telegramId}</code>\n` +
            `💵 Miqdor: <b>${fmt(req.amount)} UZS</b>\n` +
            `🎁 Bonus (+${BONUS_PERCENT}%): <b>${fmt(req.bonusAmount)} UZS</b>\n` +
            `💰 Jami: <b>${fmt(req.amount + req.bonusAmount)} UZS</b>`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[
            { text: "✅ Tasdiqlash", callback_data: `dep_ok_${reqId}` },
            { text: "❌ Rad etish", callback_data: `dep_no_${reqId}` },
          ]]}
        });
      } catch (err) {
        logger.error({ err, adminId: ADMIN_ID }, "Admin ga xabar yuborishda xato — ADMIN_TELEGRAM_ID ni tekshiring");
      }
    }
  });

  // Text handler
  bot.on("message", async (msg) => {
    if (!msg.text || !msg.from || msg.text.startsWith("/")) return;
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // Ban check (skip for admins)
    const isAdminForBanCheck = !ADMIN_ID || userId === ADMIN_ID;
    if (!isAdminForBanCheck) {
      const [checkBan] = await db.select({ banned: playersTable.banned }).from(playersTable).where(eq(playersTable.telegramId, String(userId)));
      if (checkBan?.banned) {
        await bot!.sendMessage(chatId, "🚫 Hisobingiz bloklangan. Yordam uchun admin bilan bog'laning.");
        return;
      }
    }

    // /cancel — clears all waiting states
    if (text === "/cancel") {
      waitingForBroadcast.delete(userId);
      waitingForHelp.delete(userId);
      adminReplyTarget.delete(userId);
      waitingForSendId.delete(userId);
      waitingForSendMsg.delete(userId);
      waitingForAddbalId.delete(userId);
      waitingForAddbalAmount.delete(userId);
      waitingForBanId.delete(userId);
      waitingForPromoCode.delete(userId);
      waitingForPromoAmount.delete(userId);
      waitingForPromoMaxUses.delete(userId);
      await bot!.sendMessage(chatId, "❌ Bekor qilindi.", { parse_mode: "HTML" });
      return;
    }

    // Admin: send to specific user — step 1: got user ID
    if (waitingForSendId.has(userId)) {
      const targetId = text.trim();
      if (!/^\d+$/.test(targetId)) {
        await bot!.sendMessage(chatId, "❌ Noto'g'ri format. Faqat raqam kiriting.\nMasalan: <code>123456789</code>", { parse_mode: "HTML" });
        return;
      }
      const [pl] = await db.select().from(playersTable).where(eq(playersTable.telegramId, targetId));
      const name = pl ? (pl.username ? `@${pl.username}` : pl.firstName) : `ID: ${targetId}`;
      waitingForSendId.delete(userId);
      waitingForSendMsg.set(userId, targetId);
      await bot!.sendMessage(chatId,
        `💌 <b>Xabar matni</b>\n\nKimga: <b>${name}</b>\n🆔 <code>${targetId}</code>\n\nYubormoqchi bo'lgan xabarni yozing:\n\n<i>Bekor qilish uchun /cancel</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: send to specific user — step 2: got message text
    if (waitingForSendMsg.has(userId)) {
      const targetId = waitingForSendMsg.get(userId)!;
      waitingForSendMsg.delete(userId);
      try {
        await bot!.sendMessage(Number(targetId), `📩 <b>Admin xabari:</b>\n\n${text}`, { parse_mode: "HTML" });
        await bot!.sendMessage(chatId, `✅ <b>Xabar yuborildi!</b>\n🆔 <code>${targetId}</code>`, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] }
        });
      } catch {
        await bot!.sendMessage(chatId, `❌ Xabar yuborib bo'lmadi. ID noto'g'ri yoki foydalanuvchi botni bloklagan.`);
      }
      return;
    }

    // Admin: add balance — step 1: got user ID
    if (waitingForAddbalId.has(userId)) {
      const targetId = text.trim();
      if (!/^\d+$/.test(targetId)) {
        await bot!.sendMessage(chatId, "❌ Noto'g'ri format. Faqat raqam kiriting.", { parse_mode: "HTML" });
        return;
      }
      const [pl] = await db.select().from(playersTable).where(eq(playersTable.telegramId, targetId));
      if (!pl) {
        await bot!.sendMessage(chatId, `❌ Foydalanuvchi topilmadi: <code>${targetId}</code>\n\nID to'g'riligini tekshiring.`, { parse_mode: "HTML" });
        return;
      }
      const name = pl.username ? `@${pl.username}` : pl.firstName;
      waitingForAddbalId.delete(userId);
      waitingForAddbalAmount.set(userId, targetId);
      await bot!.sendMessage(chatId,
        `💰 <b>Balans Qo'shish</b>\n\n👤 Foydalanuvchi: <b>${name}</b>\n🆔 <code>${targetId}</code>\n💵 Joriy balans: <b>${fmt(pl.balance)} UZS</b>\n\nQancha qo'shish kerak? (UZS):\n\n<i>Bekor qilish uchun /cancel</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: add balance — step 2: got amount
    if (waitingForAddbalAmount.has(userId)) {
      const targetId = waitingForAddbalAmount.get(userId)!;
      const amount = Number(text.replace(/\s/g, ""));
      if (!amount || isNaN(amount) || amount <= 0) {
        await bot!.sendMessage(chatId, "❌ Noto'g'ri miqdor. Faqat musbat raqam kiriting.\nMasalan: <code>50000</code>", { parse_mode: "HTML" });
        return;
      }
      waitingForAddbalAmount.delete(userId);
      const [pl] = await db.select().from(playersTable).where(eq(playersTable.telegramId, targetId));
      if (!pl) { await bot!.sendMessage(chatId, "❌ Foydalanuvchi topilmadi."); return; }
      const newBal = pl.balance + amount;
      await db.update(playersTable).set({ balance: newBal, updatedAt: new Date() }).where(eq(playersTable.telegramId, targetId));
      const name = pl.username ? `@${pl.username}` : pl.firstName;
      // Notify user
      try {
        await bot!.sendMessage(Number(targetId),
          `🎁 <b>Hisobingizga bonus qo'shildi!</b>\n\n💰 Qo'shildi: <b>+${fmt(amount)} UZS</b>\n💵 Yangi balans: <b>${fmt(newBal)} UZS</b>\n\nO'yiningiz omadli bo'lsin! 🎮`,
          { parse_mode: "HTML" }
        );
      } catch {}
      await bot!.sendMessage(chatId,
        `✅ <b>Balans qo'shildi!</b>\n\n👤 ${name}\n🆔 <code>${targetId}</code>\n➕ Qo'shildi: <b>${fmt(amount)} UZS</b>\n💵 Yangi balans: <b>${fmt(newBal)} UZS</b>`,
        { parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] }
        }
      );
      return;
    }

    // Admin: ban/unban — got user ID
    if (waitingForBanId.has(userId)) {
      const targetId = text.replace(/\s/g, "");
      if (!/^\d+$/.test(targetId)) {
        await bot!.sendMessage(chatId, "❌ Noto'g'ri ID. Faqat raqam kiriting:\n<i>Bekor qilish: /cancel</i>", { parse_mode: "HTML" });
        return;
      }
      waitingForBanId.delete(userId);
      const [pl] = await db.select().from(playersTable).where(eq(playersTable.telegramId, targetId));
      if (!pl) { await bot!.sendMessage(chatId, "❌ Foydalanuvchi topilmadi."); return; }
      const newBanned = !pl.banned;
      await db.update(playersTable).set({ banned: newBanned, updatedAt: new Date() }).where(eq(playersTable.telegramId, targetId));
      const name = pl.username ? `@${pl.username}` : pl.firstName;
      const statusText = newBanned ? "🚫 <b>BAN QILINDI</b>" : "✅ <b>BAN OLIB TASHLANDI</b>";
      await bot!.sendMessage(chatId,
        `${statusText}\n\n👤 ${name}\n🆔 <code>${targetId}</code>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] } }
      );
      try {
        const notifyText = newBanned
          ? "🚫 Hisobingiz admin tomonidan bloklandi. Yordam uchun murojaat qiling."
          : "✅ Hisobingiz admin tomonidan tiklandi. Yana o'yin o'ynashingiz mumkin!";
        await bot!.sendMessage(Number(targetId), notifyText);
      } catch {}
      return;
    }

    // Admin: promo creation — step 1: got code name
    if (waitingForPromoCode.has(userId)) {
      const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 3) {
        await bot!.sendMessage(chatId, "❌ Kod kamida 3 ta belgi bo'lishi kerak (A-Z, 0-9).\n<i>Bekor qilish: /cancel</i>", { parse_mode: "HTML" });
        return;
      }
      waitingForPromoCode.delete(userId);
      waitingForPromoAmount.set(userId, code);
      await bot!.sendMessage(chatId,
        `✅ Kod: <code>${code}</code>\n\nBu kodni ishlatganda qancha UZS berilsin?`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: promo creation — step 2: got amount
    if (waitingForPromoAmount.has(userId)) {
      const code = waitingForPromoAmount.get(userId)!;
      const amount = Number(text.replace(/\s/g, ""));
      if (!amount || isNaN(amount) || amount <= 0) {
        await bot!.sendMessage(chatId, "❌ Noto'g'ri miqdor. Masalan: <code>10000</code>\n<i>Bekor qilish: /cancel</i>", { parse_mode: "HTML" });
        return;
      }
      waitingForPromoAmount.delete(userId);
      waitingForPromoMaxUses.set(userId, { code, amount });
      await bot!.sendMessage(chatId,
        `✅ Miqdor: <b>${fmt(amount)} UZS</b>\n\nBu kodni necha marta ishlatish mumkin? (raqam kiriting)`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: promo creation — step 3: got maxUses
    if (waitingForPromoMaxUses.has(userId)) {
      const { code, amount } = waitingForPromoMaxUses.get(userId)!;
      const maxUses = Number(text.replace(/\s/g, ""));
      if (!maxUses || isNaN(maxUses) || maxUses <= 0) {
        await bot!.sendMessage(chatId, "❌ Noto'g'ri son. Masalan: <code>10</code>\n<i>Bekor qilish: /cancel</i>", { parse_mode: "HTML" });
        return;
      }
      waitingForPromoMaxUses.delete(userId);
      try {
        await db.insert(promoCodesTable).values({ code, amount, maxUses });
        await bot!.sendMessage(chatId,
          `✅ <b>Promo Kod Yaratildi!</b>\n\n🎫 Kod: <code>${code}</code>\n💰 Miqdor: <b>${fmt(amount)} UZS</b>\n📊 Limit: <b>${maxUses}</b> marta`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [
            [{ text: "🎫 Promo Kodlar", callback_data: "admin_promo" }],
            [{ text: "🔙 Admin panel", callback_data: "admin_panel" }],
          ]}}
        );
      } catch {
        await bot!.sendMessage(chatId, `❌ Xato: Bu kod allaqachon mavjud yoki boshqa xatolik yuz berdi.`);
      }
      return;
    }

    // Admin broadcast message
    if (waitingForBroadcast.has(userId)) {
      waitingForBroadcast.delete(userId);
      const allPlayers = await db.select({ telegramId: playersTable.telegramId }).from(playersTable);
      await bot!.sendMessage(chatId, `📢 <b>${allPlayers.length} ta foydalanuvchiga yuborilmoqda...</b>`, { parse_mode: "HTML" });
      let sent = 0, failed = 0;
      for (const pl of allPlayers) {
        try {
          await bot!.sendMessage(Number(pl.telegramId),
            `📢 <b>Admin xabari:</b>\n\n${text}`,
            { parse_mode: "HTML" }
          );
          sent++;
          await new Promise(r => setTimeout(r, 50)); // rate limit
        } catch { failed++; }
      }
      await bot!.sendMessage(chatId,
        `✅ <b>Yuborildi!</b>\n✅ Muvaffaqiyatli: <b>${sent} ta</b>\n❌ Yuborilmadi: <b>${failed} ta</b>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] } }
      );
      return;
    }

    // Admin reply to user help question
    if (adminReplyTarget.has(userId)) {
      const targetId = adminReplyTarget.get(userId)!;
      adminReplyTarget.delete(userId);
      try {
        await bot!.sendMessage(targetId,
          `📩 <b>Admin javobi:</b>\n\n${text}`,
          { parse_mode: "HTML" }
        );
        await bot!.sendMessage(chatId, "✅ Javob yuborildi!", { parse_mode: "HTML" });
      } catch {
        await bot!.sendMessage(chatId, "❌ Foydalanuvchiga xabar yuborib bo'lmadi.", { parse_mode: "HTML" });
      }
      return;
    }

    // Help question from user
    if (waitingForHelp.has(userId)) {
      waitingForHelp.delete(userId);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(userId)));
      const name = p?.firstName ?? "Noma'lum";
      const username = p?.username ? `@${p.username}` : "—";
      if (ADMIN_ID) {
        adminReplyTarget.set(ADMIN_ID, userId);
        await bot!.sendMessage(ADMIN_ID,
          `❓ <b>YORDAM SO'ROVI</b>\n\n` +
          `👤 ${name} (${username})\n` +
          `🆔 <code>${userId}</code>\n\n` +
          `💬 <b>Savol:</b>\n${text}`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
            { text: "📩 Javob berish", callback_data: `reply_help_${userId}` },
          ]]}}
        );
      }
      await bot!.sendMessage(chatId,
        `✅ <b>Savolingiz adminga yuborildi!</b>\n\n⏳ Tez orada javob beriladi.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Custom deposit amount
    if (waitingForAmount.has(userId)) {
      const amount = Number(text.replace(/\s+/g, "").replace(/,/g, ""));
      if (isNaN(amount) || amount < 1000) {
        await bot!.sendMessage(chatId, `❌ Noto'g'ri miqdor. Kamida <b>1,000 UZS</b> kiriting:`, { parse_mode: "HTML" });
        return;
      }
      if (amount > 50000000) {
        await bot!.sendMessage(chatId, `❌ Miqdor juda katta. Maksimal: <b>50,000,000 UZS</b>`, { parse_mode: "HTML" });
        return;
      }
      waitingForAmount.delete(userId);
      await sendDepositCard(chatId, amount, userId);
      return;
    }

    // Custom withdraw amount
    if (waitingForWithdrawAmount.has(userId)) {
      const amount = Number(text.replace(/\s+/g, "").replace(/,/g, ""));
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(userId)));
      if (!p) return;
      if (isNaN(amount) || amount < 1000) {
        await bot!.sendMessage(chatId, `❌ Noto'g'ri miqdor. Kamida <b>1,000 UZS</b> kiriting:`, { parse_mode: "HTML" });
        return;
      }
      if (amount > p.balance) {
        await bot!.sendMessage(chatId, `❌ Balans yetarli emas! Sizda <b>${fmt(p.balance)} UZS</b> bor.`, { parse_mode: "HTML" });
        return;
      }
      waitingForWithdrawAmount.delete(userId);
      pendingWithdraw.set(userId, { amount });
      await bot!.sendMessage(chatId,
        `💸 <b>Karta ma'lumotlarini yuboring:</b>\n\n<code>KARTA: 8600123456789012\nEGASI: Ismingiz Familiyangiz</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Withdraw card info
    const pw = pendingWithdraw.get(userId);
    if (pw) {
      const cardMatch = text.match(/KARTA:\s*(\d[\d\s]+\d)/i);
      const holderMatch = text.match(/EGASI:\s*(.+)/i);
      if (!cardMatch || !holderMatch) {
        await bot!.sendMessage(chatId, "❌ Format noto'g'ri. Qaytadan yuboring:\n<code>KARTA: 8600123456789012\nEGASI: Ismingiz Familiyangiz</code>", { parse_mode: "HTML" });
        return;
      }
      const cardNumber = cardMatch[1].replace(/\s+/g, "");
      const cardHolder = holderMatch[1].trim();
      pendingWithdraw.delete(userId);

      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(userId)));
      if (!p || p.balance < pw.amount) { await bot!.sendMessage(chatId, "❌ Balans yetarli emas!"); return; }

      await db.update(playersTable).set({ balance: p.balance - pw.amount, updatedAt: new Date() }).where(eq(playersTable.telegramId, String(userId)));
      const [req] = await db.insert(withdrawRequestsTable).values({
        playerId: p.id, telegramId: String(userId), amount: pw.amount, cardNumber, cardHolder,
      }).returning();

      await bot!.sendMessage(chatId, `⏳ <b>So'rovingiz adminga yuborildi!</b>`, { parse_mode: "HTML" });

      if (ADMIN_ID) {
        try {
          await bot!.sendMessage(ADMIN_ID,
            `💸 <b>PUL YECHISH SO'ROVI</b>\n\n👤 ${p.firstName} (@${p.username ?? "—"})\n🆔 <code>${p.telegramId}</code>\n💵 Miqdor: <b>${fmt(pw.amount)} UZS</b>\n💳 Karta: <code>${cardNumber}</code>\n👤 Egasi: ${cardHolder}`,
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
              { text: "✅ To'landi", callback_data: `wd_ok_${req.id}` },
              { text: "❌ Rad", callback_data: `wd_no_${req.id}` },
            ]]}}
          );
        } catch (err) {
          logger.error({ err, adminId: ADMIN_ID }, "Admin ga yechish so'rovi yuborishda xato");
        }
      }
    }
  });

  // Callback handler
  bot.on("callback_query", async (q) => {
    if (!q.message || !q.from) return;
    const chatId = q.message.chat.id;
    const data = q.data || "";

    try {

    // Subscription check
    if (data === "check_sub") {
      await bot!.answerCallbackQuery(q.id, { text: "✅ Rahmat! Xush kelibsiz!" });
      const p = await getOrCreatePlayer(q.from);
      // Mark as channel verified — won't be asked again
      await db.update(playersTable)
        .set({ channelVerified: true, updatedAt: new Date() })
        .where(eq(playersTable.telegramId, String(q.from.id)));
      const isAdminUser = !ADMIN_ID || q.from.id === ADMIN_ID;
      await mainMenu(chatId, q.from.first_name, p.balance, isAdminUser);
      return;
    }

    // ◀️ Back to main menu — edit in-place, no new message
    if (data === "main_menu") {
      await bot!.answerCallbackQuery(q.id);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(q.from.id)));
      const isAdminUser = !ADMIN_ID || q.from.id === ADMIN_ID;
      await editToMainMenu(chatId, q.message.message_id, q.from.first_name, p?.balance ?? 0, isAdminUser);
      return;
    }

    // Balance
    if (data === "balance") {
      await bot!.answerCallbackQuery(q.id);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(q.from.id)));
      const wagerLeft = Math.max(0, (p?.wagerRequirement ?? 0) - (p?.totalWagered ?? 0));
      try { await bot!.editMessageText(
        `💰 <b>Hisobingiz</b>\n\n💵 Balans: <b>${fmt(p?.balance ?? 0)} UZS</b>\n🎮 O'yinlar: <b>${p?.gamesPlayed ?? 0}</b>\n🏆 Yutgan: <b>${fmt(p?.totalWon ?? 0)} UZS</b>\n📈 O'ynaldi: <b>${fmt(p?.totalWagered ?? 0)} UZS</b>\n` +
        (wagerLeft > 0 ? `\n⚠️ Chiqarish uchun yana <b>${fmt(wagerLeft)} UZS</b> o'ynash kerak` : `\n✅ Chiqarishga ruxsat bor`),
        { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "◀️ Ortga", callback_data: "main_menu" }]] } }
      ); } catch {}
      return;
    }

    // How to
    if (data === "howto") {
      await bot!.answerCallbackQuery(q.id);
      try { await bot!.editMessageText(
        `📖 <b>BARCHA O'YINLAR QOIDALARI</b>\n\n` +
        `🍎 <b>Olma Omadi</b>\n  └ Har qatorda olmalarni toping, bomba topmasdan yuqoriga chiqing\n\n` +
        `🎲 <b>Zar (Dice)</b>\n  └ 7 dan KO'P x2.3 | TENG 7 x5.8 | 7 dan KAM x2.3\n\n` +
        `✈️ <b>Aviator</b>\n  └ Samolyot uchayotganida o'z vaqtida oling, qulagach yutqazasiz!\n\n` +
        `🎡 <b>Spin</b>\n  └ Bepul spin 24 soatda 1 ta\n  └ 🍒 1 000 | ⭐ 2 000 | 💎 5 000 UZS\n\n` +
        `🃏 <b>Blackjack</b>\n  └ 21 ga yaqin qoling | Blackjack=x2.5 | G'alaba=x2\n\n` +
        `🎰 <b>Slot</b>\n  └ 777=x10 | 3 bir xil=x3 | 2 bir xil=x1.5\n\n` +
        `🔢 <b>Toq-Juft (Parity)</b>\n  └ 1-90 son | JUFT/TOQ/KICHIK/KATTA = x2\n\n` +
        `💡 <b>Depozit:</b> +20% bonus | <b>Yechish:</b> 100% wager kerak`,
        { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "◀️ Ortga", callback_data: "main_menu" }]] } }
      ); } catch {}
      return;
    }

    // Deposit menu
    if (data === "deposit_menu") {
      await bot!.answerCallbackQuery(q.id);
      try { await bot!.editMessageText(
        `➕ <b>Hisob To'ldirish</b>\n\n🎁 Har qanday miqdorga <b>+${BONUS_PERCENT}% bonus</b>!\n\n💳 Karta: <code>${CARD_NUMBER}</code>\n👤 ${CARD_HOLDER}\n\nMiqdorni tanlang yoki o'zingiz kiriting:`,
        { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: "💵 10,000 UZS", callback_data: "dep_10000" }, { text: "💵 25,000 UZS", callback_data: "dep_25000" }],
          [{ text: "💵 50,000 UZS", callback_data: "dep_50000" }, { text: "💵 100,000 UZS", callback_data: "dep_100000" }],
          [{ text: "💵 250,000 UZS", callback_data: "dep_250000" }, { text: "💵 500,000 UZS", callback_data: "dep_500000" }],
          [{ text: "✍️ O'zim yozaman", callback_data: "dep_custom" }],
          [{ text: "◀️ Ortga", callback_data: "main_menu" }],
        ]}}
      ); } catch {}
      return;
    }

    // Custom deposit amount
    if (data === "dep_custom") {
      await bot!.answerCallbackQuery(q.id);
      waitingForAmount.add(q.from.id);
      await bot!.sendMessage(chatId,
        `✍️ <b>Miqdorni kiriting:</b>\n\nFaqat raqam yuboring (UZS)\nMasalan: <code>75000</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Preset deposit amounts
    if (data.startsWith("dep_") && !data.startsWith("dep_ok") && !data.startsWith("dep_no") && data !== "dep_custom") {
      const amount = Number(data.split("_")[1]);
      if (!amount) return;
      await bot!.answerCallbackQuery(q.id);
      await sendDepositCard(chatId, amount, q.from.id);
      return;
    }

    // Admin: approve deposit
    if (data.startsWith("dep_ok_")) {
      logger.info({ fromId: q.from.id, adminId: ADMIN_ID }, "dep_ok clicked");
      if (ADMIN_ID && q.from.id !== ADMIN_ID) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      const reqId = Number(data.split("_")[2]);
      const [req] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, reqId));
      if (!req || req.status !== "pending") { await bot!.answerCallbackQuery(q.id, { text: "Allaqachon qayta ishlangan" }); return; }
      await db.update(depositRequestsTable).set({ status: "approved" }).where(eq(depositRequestsTable.id, reqId));
      const [p] = await db.select().from(playersTable).where(eq(playersTable.id, req.playerId));
      const total = req.amount + req.bonusAmount;
      await db.update(playersTable).set({
        balance: p.balance + total,
        totalDeposited: p.totalDeposited + req.amount,
        wagerRequirement: p.wagerRequirement + req.amount,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, req.playerId));
      await bot!.answerCallbackQuery(q.id, { text: "✅ Tasdiqlandi!" });
      try { await bot!.editMessageCaption(`✅ TASDIQLANDI — ${fmt(req.amount)} UZS + ${fmt(req.bonusAmount)} bonus`, { chat_id: chatId, message_id: q.message.message_id }); } catch {}
      await bot!.sendMessage(Number(req.telegramId),
        `🎉 <b>Depozitingiz tasdiqlandi!</b>\n\n💵 Miqdor: <b>${fmt(req.amount)} UZS</b>\n🎁 Bonus: <b>+${fmt(req.bonusAmount)} UZS</b>\n💰 Jami: <b>${fmt(total)} UZS</b>\n\nO'yiningiz omadli bo'lsin! 🎮`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: reject deposit
    if (data.startsWith("dep_no_")) {
      if (ADMIN_ID && q.from.id !== ADMIN_ID) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      const reqId = Number(data.split("_")[2]);
      const [req] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, reqId));
      if (!req) return;
      await db.update(depositRequestsTable).set({ status: "rejected" }).where(eq(depositRequestsTable.id, reqId));
      await bot!.answerCallbackQuery(q.id, { text: "❌ Rad etildi" });
      try { await bot!.editMessageCaption(`❌ RAD ETILDI`, { chat_id: chatId, message_id: q.message.message_id }); } catch {}
      await bot!.sendMessage(Number(req.telegramId), `❌ <b>Depozitingiz rad etildi.</b>\nMuammo bo'lsa admin bilan bog'laning.`, { parse_mode: "HTML" });
      return;
    }

    // Withdraw menu
    if (data === "withdraw_menu") {
      await bot!.answerCallbackQuery(q.id);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(q.from.id)));
      if (!p) return;
      const wagerLeft = Math.max(0, p.wagerRequirement - p.totalWagered);
      const msgId = q.message.message_id;
      if (wagerLeft > 0) {
        try { await bot!.editMessageText(
          `💸 <b>Pul Yechish</b>\n\n⚠️ <b>Shart bajarilmagan!</b>\n\n• Kerakli: ${fmt(p.wagerRequirement)} UZS\n• O'ynaldi: ${fmt(p.totalWagered)} UZS\n• Qolgan: <b>${fmt(wagerLeft)} UZS</b>\n\n💡 Depozit miqdorini 100% o'ynasangiz pul yechi olasiz!`,
          { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "◀️ Ortga", callback_data: "main_menu" }]] } }
        ); } catch {}
        return;
      }
      try { await bot!.editMessageText(
        `💸 <b>Pul Yechish</b>\n\n💰 Balans: <b>${fmt(p.balance)} UZS</b>\n\nMiqdorni tanlang:`,
        { chat_id: chatId, message_id: msgId, parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: `💵 25%  — ${fmt(Math.floor(p.balance*0.25))} UZS`, callback_data: `wd_${Math.floor(p.balance*0.25)}` }],
          [{ text: `💵 50%  — ${fmt(Math.floor(p.balance*0.50))} UZS`, callback_data: `wd_${Math.floor(p.balance*0.50)}` }],
          [{ text: `💵 75%  — ${fmt(Math.floor(p.balance*0.75))} UZS`, callback_data: `wd_${Math.floor(p.balance*0.75)}` }],
          [{ text: `💵 100% — ${fmt(p.balance)} UZS`, callback_data: `wd_${p.balance}` }],
          [{ text: "✍️ O'zim yozaman", callback_data: "wd_custom" }],
          [{ text: "◀️ Ortga", callback_data: "main_menu" }],
        ]}}
      ); } catch {}
      return;
    }

    // Withdraw custom amount input
    if (data === "wd_custom") {
      await bot!.answerCallbackQuery(q.id);
      waitingForWithdrawAmount.add(q.from.id);
      await bot!.sendMessage(chatId,
        `✍️ <b>Yechish miqdorini kiriting (UZS):</b>\n\nFaqat raqam yuboring.\nMasalan: <code>15000</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Withdraw preset amount
    if (data.startsWith("wd_") && !data.startsWith("wd_ok") && !data.startsWith("wd_no")) {
      const amount = Number(data.split("_")[1]);
      if (!amount) return;
      await bot!.answerCallbackQuery(q.id);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(q.from.id)));
      if (!p || p.balance < amount) { await bot!.sendMessage(chatId, "❌ Balans yetarli emas!"); return; }
      pendingWithdraw.set(q.from.id, { amount });
      await bot!.sendMessage(chatId,
        `💸 <b>Karta ma'lumotlarini yuboring:</b>\n\n<code>KARTA: 8600123456789012\nEGASI: Ismingiz Familiyangiz</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: approve withdraw
    if (data.startsWith("wd_ok_")) {
      if (q.from.id !== ADMIN_ID) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      const reqId = Number(data.split("_")[2]);
      const [req] = await db.select().from(withdrawRequestsTable).where(eq(withdrawRequestsTable.id, reqId));
      if (!req || req.status !== "pending") { await bot!.answerCallbackQuery(q.id, { text: "Allaqachon qayta ishlangan" }); return; }
      await db.update(withdrawRequestsTable).set({ status: "approved" }).where(eq(withdrawRequestsTable.id, reqId));
      // Track totalWithdrawn on player
      const [playerW] = await db.select().from(playersTable).where(eq(playersTable.telegramId, req.telegramId));
      if (playerW) {
        await db.update(playersTable).set({ totalWithdrawn: playerW.totalWithdrawn + req.amount, updatedAt: new Date() }).where(eq(playersTable.telegramId, req.telegramId));
      }
      await bot!.answerCallbackQuery(q.id, { text: "✅ Tasdiqlandi!" });
      try { await bot!.editMessageText(`✅ TASDIQLANDI — ${fmt(req.amount)} UZS`, { chat_id: chatId, message_id: q.message.message_id }); } catch {}
      await bot!.sendMessage(Number(req.telegramId),
        `✅ <b>Pul yechish tasdiqlandi!</b>\n\n💵 <b>${fmt(req.amount)} UZS</b> kartangizga o'tkazildi.\n🏦 Karta: <code>${req.cardNumber}</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: reject withdraw
    if (data.startsWith("wd_no_")) {
      if (q.from.id !== ADMIN_ID) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      const reqId = Number(data.split("_")[2]);
      const [req] = await db.select().from(withdrawRequestsTable).where(eq(withdrawRequestsTable.id, reqId));
      if (!req) return;
      await db.update(withdrawRequestsTable).set({ status: "rejected" }).where(eq(withdrawRequestsTable.id, reqId));
      const [p] = await db.select().from(playersTable).where(eq(playersTable.id, req.playerId));
      await db.update(playersTable).set({ balance: p.balance + req.amount, updatedAt: new Date() }).where(eq(playersTable.id, req.playerId));
      await bot!.answerCallbackQuery(q.id, { text: "❌ Rad etildi" });
      try { await bot!.editMessageText(`❌ RAD ETILDI`, { chat_id: chatId, message_id: q.message.message_id }); } catch {}
      await bot!.sendMessage(Number(req.telegramId), `❌ <b>Pul yechish rad etildi.</b>\nBalansingiz qaytarildi.`, { parse_mode: "HTML" });
      return;
    }

    // Spin wheel
    if (data === "spin_wheel") {
      await bot!.answerCallbackQuery(q.id);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(q.from.id)));
      if (!p) return;

      const now = new Date();
      if (p.lastSpinAt) {
        const diffMs = now.getTime() - new Date(p.lastSpinAt).getTime();
        const diffH = diffMs / (1000 * 60 * 60);
        if (diffH < 24) {
          const nextSpin = new Date(new Date(p.lastSpinAt).getTime() + 24 * 60 * 60 * 1000);
          const hLeft = Math.ceil((nextSpin.getTime() - now.getTime()) / (1000 * 60 * 60));
          const mLeft = Math.ceil(((nextSpin.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
          await bot!.sendMessage(chatId,
            `⏰ <b>Hali Spin vaqti kelmadi!</b>\n\n⏳ Keyingi spin: <b>${hLeft}s ${mLeft}m</b> da\n\nHar 24 soatda 1 marta bepul!`,
            { parse_mode: "HTML" }
          );
          return;
        }
      }

      // Spin prizes: [prize, weight]
      const prizes = [0, 0, 0, 0, 500, 500, 1000, 1000, 2000, 3000, 5000];
      const prize = prizes[Math.floor(Math.random() * prizes.length)];

      const slots = ["🍎","🍋","🍇","🍒","💎","⭐","🎰","🍊","🍉","🎯","💰"];
      const spin1 = slots[Math.floor(Math.random() * slots.length)];
      const spin2 = slots[Math.floor(Math.random() * slots.length)];
      const spin3 = prize > 0 ? spin1 : slots[Math.floor(Math.random() * slots.length)];

      await db.update(playersTable).set({
        lastSpinAt: now,
        balance: p.balance + prize,
        totalWon: prize > 0 ? p.totalWon + prize : p.totalWon,
        updatedAt: now,
      }).where(eq(playersTable.telegramId, String(q.from.id)));

      if (prize > 0) {
        await bot!.sendMessage(chatId,
          `🎰 <b>[ ${spin1} | ${spin2} | ${spin1} ]</b>\n\n` +
          `🎉 <b>TABRIKLAYMIZ!</b>\n💰 Bonus: <b>+${fmt(prize)} UZS</b> balansingizga qo'shildi!\n\n` +
          `⏰ Keyingi spin ertaga mavjud bo'ladi`,
          { parse_mode: "HTML" }
        );
      } else {
        await bot!.sendMessage(chatId,
          `🎰 <b>[ ${spin1} | ${spin2} | ${spin3} ]</b>\n\n` +
          `😔 <b>Yutqazdingiz!</b>\nOmad yo'q, ertaga qaytib keling!\n\n` +
          `💡 Maksimal bonus: <b>5 000 UZS</b>\n` +
          `⏰ Keyingi spin ertaga mavjud bo'ladi`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // Referral menu
    if (data === "referral_menu") {
      await bot!.answerCallbackQuery(q.id);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(q.from.id)));
      const botInfo = await bot!.getMe();
      const refLink = `https://t.me/${botInfo.username}?start=ref_${q.from.id}`;
      const count = p?.referralCount ?? 0;
      const earned = count * 1000;
      try { await bot!.editMessageText(
        `👥 <b>REFERAL DASTURI</b>\n\n` +
        `🎁 Har bir do'stingiz uchun: <b>+1 000 UZS</b>\n\n` +
        `📊 Sizning natijangiz:\n` +
        `👤 Taklif qilganlar: <b>${count} ta</b>\n` +
        `💰 Jami topganingiz: <b>${fmt(earned)} UZS</b>\n\n` +
        `🔗 <b>Sizning havola:</b>\n<code>${refLink}</code>\n\n` +
        `📲 Havolani do'stingizga yuboring. U ro'yxatdan o'tgach, sizga <b>1 000 UZS</b> tushadi!`,
        { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "◀️ Ortga", callback_data: "main_menu" }]] } }
      ); } catch {}
      return;
    }

    // Admin: broadcast menu (from main menu button)
    if (data === "broadcast_menu") {
      if (ADMIN_ID && q.from.id !== ADMIN_ID) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      waitingForBroadcast.add(q.from.id);
      await bot!.sendMessage(chatId,
        `📢 <b>Xabar Yuborish</b>\n\nBarcha o'yinchilarga yuboriladigan xabarni yozing:\n\n<i>Bekor qilish uchun /cancel yozing</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // ═══════════════════════════════════════
    // ADMIN PANEL CALLBACKS
    // ═══════════════════════════════════════
    const isAdmin = !ADMIN_ID || q.from.id === ADMIN_ID;

    if (data === "admin_panel") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      await sendAdminMenu(chatId);
      return;
    }

    if (data === "admin_broadcast") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      waitingForBroadcast.add(q.from.id);
      await bot!.sendMessage(chatId,
        `📢 <b>Barchaga Xabar</b>\n\nBarcha o'yinchilarga yuboriladigan xabarni yozing:\n\n<i>Bekor qilish uchun /cancel yozing</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "admin_send_user") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      waitingForSendId.add(q.from.id);
      await bot!.sendMessage(chatId,
        `💌 <b>Bitta Kishiga Xabar</b>\n\nFoydalanuvchining Telegram ID sini yuboring:\n\n<i>Masalan: <code>123456789</code></i>\n<i>Bekor qilish uchun /cancel</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "admin_addbal") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      waitingForAddbalId.add(q.from.id);
      await bot!.sendMessage(chatId,
        `💰 <b>Balans / Bonus Qo'shish</b>\n\nFoydalanuvchining Telegram ID sini yuboring:\n\n<i>Masalan: <code>123456789</code></i>\n<i>Bekor qilish uchun /cancel</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "admin_stat") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [totalPlayers] = await db.select({ count: sql<number>`count(*)::int` }).from(playersTable);
        const [newToday] = await db.select({ count: sql<number>`count(*)::int` }).from(playersTable).where(sql`created_at >= ${today}`);
        const [depTotal] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::int`, cnt: sql<number>`count(*)::int` }).from(depositRequestsTable).where(eq(depositRequestsTable.status, "approved"));
        const [depToday] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::int`, cnt: sql<number>`count(*)::int` }).from(depositRequestsTable).where(sql`created_at >= ${today} and status = 'approved'`);
        const [wdToday] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::int`, cnt: sql<number>`count(*)::int` }).from(withdrawRequestsTable).where(sql`created_at >= ${today} and status = 'approved'`);
        const [wdTotal] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::int` }).from(withdrawRequestsTable).where(eq(withdrawRequestsTable.status, "approved"));
        const [totalBal] = await db.select({ total: sql<number>`coalesce(sum(balance),0)::int` }).from(playersTable);
        const pendingDeps = await db.select({ cnt: sql<number>`count(*)::int` }).from(depositRequestsTable).where(eq(depositRequestsTable.status, "pending"));
        const pendingWds = await db.select({ cnt: sql<number>`count(*)::int` }).from(withdrawRequestsTable).where(eq(withdrawRequestsTable.status, "pending"));
        await bot!.sendMessage(chatId,
          `📊 <b>STATISTIKA</b>\n\n` +
          `👥 Jami o'yinchilar: <b>${totalPlayers.count}</b>\n` +
          `🆕 Bugun yangi: <b>${newToday.count}</b>\n\n` +
          `💰 Bugun depozit: <b>${fmt(depToday.total)} UZS</b> (${depToday.cnt} ta)\n` +
          `💰 Jami depozit: <b>${fmt(depTotal.total)} UZS</b> (${depTotal.cnt} ta)\n\n` +
          `💸 Bugun yechim: <b>${fmt(wdToday.total)} UZS</b> (${wdToday.cnt} ta)\n` +
          `💸 Jami yechim: <b>${fmt(wdTotal.total)} UZS</b>\n\n` +
          `🏦 Jami balanslar: <b>${fmt(totalBal.total)} UZS</b>\n\n` +
          `⏳ Kutilayotgan:\n• Depozit: <b>${pendingDeps[0]?.cnt ?? 0} ta</b>\n• Yechim: <b>${pendingWds[0]?.cnt ?? 0} ta</b>`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] } }
        );
      } catch (err) { logger.error({ err }, "admin_stat xato"); }
      return;
    }

    if (data === "admin_users") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      const all = await db.select({
        telegramId: playersTable.telegramId,
        firstName: playersTable.firstName,
        username: playersTable.username,
        balance: playersTable.balance,
        gamesPlayed: playersTable.gamesPlayed,
      }).from(playersTable).orderBy(desc(playersTable.balance)).limit(30);
      const real = all.filter(p => p.telegramId !== "demo_user");
      const lines = real.map((p, i) => {
        const name = p.username ? `@${p.username}` : p.firstName;
        return `${i+1}. ${name}\n🆔 <code>${p.telegramId}</code> | 💰 <b>${fmt(p.balance)} UZS</b>`;
      }).join("\n\n");
      const chunks = lines.match(/[\s\S]{1,3800}/g) || ["Hali hech kim yo'q"];
      for (const chunk of chunks) {
        await bot!.sendMessage(chatId, `👥 <b>FOYDALANUVCHILAR (${real.length} ta)</b>\n\n${chunk}`,
          { parse_mode: "HTML" });
      }
      await bot!.sendMessage(chatId, "🔙", { reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] } });
      return;
    }

    if (data === "admin_pending") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      const deps = await db.select().from(depositRequestsTable)
        .where(eq(depositRequestsTable.status, "pending"))
        .orderBy(desc(depositRequestsTable.createdAt))
        .limit(20);
      if (!deps.length) {
        await bot!.sendMessage(chatId, `⏳ <b>Kutilayotgan depozitlar yo'q</b>`, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] } });
        return;
      }
      for (const dep of deps) {
        const [pl] = await db.select().from(playersTable).where(eq(playersTable.id, dep.playerId));
        const name = pl?.username ? `@${pl.username}` : (pl?.firstName ?? "—");
        const msg = `⏳ <b>KUTILAYOTGAN DEPOZIT</b>\n\n👤 ${name}\n🆔 <code>${dep.telegramId}</code>\n💵 <b>${fmt(dep.amount)} UZS</b>\n🎁 Bonus: <b>${fmt(dep.bonusAmount)} UZS</b>`;
        try {
          if (dep.telegramFileId) {
            await bot!.sendPhoto(chatId, dep.telegramFileId, {
              caption: msg, parse_mode: "HTML",
              reply_markup: { inline_keyboard: [[
                { text: "✅ Tasdiqlash", callback_data: `dep_ok_${dep.id}` },
                { text: "❌ Rad etish", callback_data: `dep_no_${dep.id}` },
              ]]}
            });
          } else {
            await bot!.sendMessage(chatId, msg, {
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [[
                { text: "✅ Tasdiqlash", callback_data: `dep_ok_${dep.id}` },
                { text: "❌ Rad etish", callback_data: `dep_no_${dep.id}` },
              ]]}
            });
          }
        } catch {}
      }
      return;
    }

    if (data === "admin_withdrawals") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      const wds = await db.select().from(withdrawRequestsTable)
        .where(eq(withdrawRequestsTable.status, "pending"))
        .orderBy(desc(withdrawRequestsTable.createdAt))
        .limit(20);
      if (!wds.length) {
        await bot!.sendMessage(chatId, `💸 <b>Kutilayotgan yechimlar yo'q</b>`, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Admin panel", callback_data: "admin_panel" }]] } });
        return;
      }
      for (const wd of wds) {
        await bot!.sendMessage(chatId,
          `💸 <b>YECHIM SO'ROVI</b>\n\n🆔 <code>${wd.telegramId}</code>\n💵 <b>${fmt(wd.amount)} UZS</b>\n💳 ${wd.cardNumber}\n👤 ${wd.cardHolder}`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
            { text: "✅ To'landi", callback_data: `wd_ok_${wd.id}` },
            { text: "❌ Rad etish", callback_data: `wd_no_${wd.id}` },
          ]]}});
      }
      return;
    }

    // Help menu
    if (data === "help_menu") {
      await bot!.answerCallbackQuery(q.id);
      waitingForHelp.add(q.from.id);
      await bot!.sendMessage(chatId,
        `❓ <b>Yordam</b>\n\n✍️ Savolingizni yozing — admin tez orada javob beradi.\n\n💬 <i>Masalan: "Depozit tushmadi", "Pul yechishda muammo" va hokazo</i>`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [[
          { text: "❌ Bekor qilish", callback_data: "cancel_help" },
        ]]}}
      );
      return;
    }

    // Cancel help
    if (data === "cancel_help") {
      waitingForHelp.delete(q.from.id);
      await bot!.answerCallbackQuery(q.id, { text: "Bekor qilindi" });
      return;
    }

    // Admin: reply to help
    if (data.startsWith("reply_help_")) {
      if (ADMIN_ID && q.from.id !== ADMIN_ID) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      const targetUserId = Number(data.split("_")[2]);
      adminReplyTarget.set(q.from.id, targetUserId);
      await bot!.answerCallbackQuery(q.id, { text: "Javobingizni yozing" });
      await bot!.sendMessage(chatId,
        `📩 <b>Javob yozing:</b>\n\nQuyidagi foydalanuvchiga javob yuboriladi: <code>${targetUserId}</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: ban/unban
    if (data === "admin_ban") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      waitingForBanId.add(q.from.id);
      await bot!.sendMessage(chatId,
        `🚫 <b>Ban / Unban</b>\n\nBan yoki unban qilmoqchi bo'lgan foydalanuvchining Telegram ID sini yuboring:\n\n<i>Bekor qilish: /cancel</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Admin: promo codes list
    if (data === "admin_promo") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      const codes = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.id)).limit(20);
      const lines = codes.length === 0 ? "Hali promo-kodlar yo'q" : codes.map(c =>
        `🎫 <code>${c.code}</code> — ${fmt(c.amount)} UZS\n   Limit: ${c.usedCount}/${c.maxUses} | ${c.active ? "✅ Faol" : "❌ O'chirilgan"}`
      ).join("\n\n");
      await bot!.sendMessage(chatId,
        `🎫 <b>PROMO KODLAR</b>\n\n${lines}`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [
          [{ text: "➕ Yangi Promo Kod", callback_data: "admin_promo_create" }],
          [{ text: "🔙 Admin panel", callback_data: "admin_panel" }],
        ]}}
      );
      return;
    }

    if (data === "admin_promo_create") {
      if (!isAdmin) { await bot!.answerCallbackQuery(q.id, { text: "❌ Ruxsat yo'q" }); return; }
      await bot!.answerCallbackQuery(q.id);
      waitingForPromoCode.add(q.from.id);
      await bot!.sendMessage(chatId,
        `🎫 <b>Yangi Promo Kod</b>\n\nKod nomini yuboring (faqat lotin harflari va raqamlar):\n\n<i>Masalan: SUMMER2024</i>\n<i>Bekor qilish: /cancel</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Reyting
    if (data === "reyting") {
      await bot!.answerCallbackQuery(q.id);
      try {
        const resp = await fetch(`http://localhost:${process.env.PORT || 8080}/api/game/leaderboard`);
        const lb = await resp.json() as { topDepositors: any[]; topWithdrawers: any[] };

        const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
        const fmtEntry = (e: any, i: number) => {
          const medal = medals[i] ?? `${i+1}.`;
          const name = e.username ? `@${e.username}` : e.firstName;
          const amt = Number(e.amount) || 0;
          return `${medal} ${name} — <b>${fmt(amt)} UZS</b>`;
        };

        const depositors = (lb.topDepositors || []).slice(0, 5).map(fmtEntry).join("\n") || "—";
        const withdrawers = (lb.topWithdrawers || []).slice(0, 5).map(fmtEntry).join("\n") || "—";

        // User's own stats
        const [me] = await db.select().from(playersTable).where(eq(playersTable.telegramId, String(q.from.id)));
        const myDeposited = me?.totalDeposited ?? 0;
        const myWithdrawn = me?.totalWithdrawn ?? 0;
        const myGames = me?.gamesPlayed ?? 0;

        await bot!.sendMessage(chatId,
          `🏆 <b>REYTING</b>\n\n` +
          `🎯 <b>Sizning natijangiz:</b>\n` +
          `🎮 O'yinlar: <b>${myGames}</b>  |  💰 Tashlagan: <b>${fmt(myDeposited)} UZS</b>  |  💸 Chiqargan: <b>${fmt(myWithdrawn)} UZS</b>\n\n` +
          `💰 <b>Ko'p Pul Tashlaganlar (Top 5):</b>\n${depositors}\n\n` +
          `💸 <b>Ko'p Pul Chiqarganlar (Top 5):</b>\n${withdrawers}`,
          { parse_mode: "HTML" }
        );
      } catch {
        await bot!.sendMessage(chatId, "❌ Reyting yuklanmadi. Keyinroq urinib ko'ring.", { parse_mode: "HTML" });
      }
      return;
    }

    await bot!.answerCallbackQuery(q.id);

    } catch (err) {
      logger.error({ err, data, userId: q.from.id }, "Callback query xatosi");
      try { await bot!.answerCallbackQuery(q.id, { text: "❌ Xato yuz berdi, qayta urinib ko'ring" }); } catch {}
    }
  });

  bot.on("polling_error", (e) => logger.error({ err: e }, "Bot polling error"));
}
