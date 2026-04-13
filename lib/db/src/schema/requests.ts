import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const depositRequestsTable = pgTable("deposit_requests", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  telegramId: text("telegram_id").notNull(),
  amount: integer("amount").notNull(),
  bonusAmount: integer("bonus_amount").notNull(),
  telegramFileId: text("telegram_file_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const withdrawRequestsTable = pgTable("withdraw_requests", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  telegramId: text("telegram_id").notNull(),
  amount: integer("amount").notNull(),
  cardNumber: text("card_number").notNull(),
  cardHolder: text("card_holder").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DepositRequest = typeof depositRequestsTable.$inferSelect;
export type WithdrawRequest = typeof withdrawRequestsTable.$inferSelect;
