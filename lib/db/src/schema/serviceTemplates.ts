import {
  boolean,
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
import { productsTable } from "./products";

export const serviceTemplatesTable = pgTable("service_templates", {
  id: serial("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teamsTable.id),
  name: text("name").notNull(),
  serviceScopeEnabled: boolean("service_scope_enabled").notNull().default(false),
  serviceDescription: text("service_description"),
  notes: text("notes"),
  laborCost: numeric("labor_cost", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const serviceTemplateItemsTable = pgTable("service_template_items", {
  id: serial("id").primaryKey(),
  serviceTemplateId: integer("service_template_id")
    .notNull()
    .references(() => serviceTemplatesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
});

export const insertServiceTemplateSchema = createInsertSchema(
  serviceTemplatesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertServiceTemplate = z.infer<typeof insertServiceTemplateSchema>;
export type ServiceTemplate = typeof serviceTemplatesTable.$inferSelect;

export const insertServiceTemplateItemSchema = createInsertSchema(
  serviceTemplateItemsTable,
).omit({ id: true });
export type InsertServiceTemplateItem = z.infer<
  typeof insertServiceTemplateItemSchema
>;
export type ServiceTemplateItem = typeof serviceTemplateItemsTable.$inferSelect;