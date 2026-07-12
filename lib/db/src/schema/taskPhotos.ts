import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const taskPhotosTable = pgTable("task_photos", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTaskPhotoSchema = createInsertSchema(taskPhotosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskPhoto = z.infer<typeof insertTaskPhotoSchema>;
export type TaskPhoto = typeof taskPhotosTable.$inferSelect;
