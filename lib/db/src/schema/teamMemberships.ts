import { pgTable, serial, text, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

/**
 * Join table: one user can belong to many teams.
 * users.teamId stores the *active* team for routing; this table is the
 * source of truth for all memberships.
 */
export const teamMembershipsTable = pgTable(
  "team_memberships",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teamsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("team_memberships_user_team_unique").on(t.userId, t.teamId)],
);

export type TeamMembership = typeof teamMembershipsTable.$inferSelect;
