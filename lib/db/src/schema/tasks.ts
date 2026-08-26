import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { clientsTable } from "./clients";
import { quotesTable } from "./quotes";

export const taskStatusValues = [
  "scheduled",
  "in_progress",
  "completed",
  "paid",
] as const;

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teamsTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  quoteId: integer("quote_id").references(() => quotesTable.id, {
    onDelete: "restrict",
  }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  status: text("status", { enum: taskStatusValues })
    .notNull()
    .default("scheduled"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("tasks_quote_id_unique").on(table.quoteId),
]);

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
