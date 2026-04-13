import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  balance: integer("balance").notNull().default(0),
  totalWon: integer("total_won").notNull().default(0),
  totalLost: integer("total_lost").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  totalDeposited: integer("total_deposited").notNull().default(0),
  totalWithdrawn: integer("total_withdrawn").notNull().default(0),
  wagerRequirement: integer("wager_requirement").notNull().default(0),
  totalWagered: integer("total_wagered").notNull().default(0),
  channelVerified: boolean("channel_verified").notNull().default(false),
  banned: boolean("banned").notNull().default(false),
  lastSpinAt: timestamp("last_spin_at"),
  lastDailyBonus: timestamp("last_daily_bonus"),
  dailyBonusStreak: integer("daily_bonus_streak").notNull().default(0),
  referredBy: text("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  game: text("game"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  amount: integer("amount").notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promoUsesTable = pgTable("promo_uses", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").notNull().references(() => promoCodesTable.id),
  telegramId: text("telegram_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });

export type Player = typeof playersTable.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type PromoCode = typeof promoCodesTable.$inferSelect;
export type PromoUse = typeof promoUsesTable.$inferSelect;
