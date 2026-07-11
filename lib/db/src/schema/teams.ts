import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
