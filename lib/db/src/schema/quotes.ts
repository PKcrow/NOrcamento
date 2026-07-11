import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { clientsTable } from "./clients";
import { productsTable } from "./products";

export const quoteStatusValues = [
  "draft",
  "sent",
  "approved",
  "rejected",
] as const;

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teamsTable.id),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id),
  status: text("status", { enum: quoteStatusValues })
    .notNull()
    .default("draft"),
  serviceDescription: text("service_description"),
  notes: text("notes"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;

export const quoteItemsTable = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
});

export const insertQuoteItemSchema = createInsertSchema(quoteItemsTable).omit({
  id: true,
});
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteItem = typeof quoteItemsTable.$inferSelect;
