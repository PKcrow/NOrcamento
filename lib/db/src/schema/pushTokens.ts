import {
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

/**
 * Expo push tokens are scoped to both a user and a team. A device may be
 * registered for more than one team, while a removed member no longer receives
 * that team's notifications because sends are joined against memberships.
 */
export const pushTokensTable = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teamsTable.id, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull(),
    platform: text("platform").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("push_tokens_team_token_unique").on(t.teamId, t.expoPushToken),
  ],
);

export type PushToken = typeof pushTokensTable.$inferSelect;