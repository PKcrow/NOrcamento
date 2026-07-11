import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, clientsTable, tasksTable } from "@workspace/db";
import { GetNotificationsResponse } from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

router.get("/notifications", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;
  const now = new Date();
  const dueSoonThreshold = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

  const pending = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.teamId, teamId), eq(tasksTable.status, "pending")))
    .orderBy(asc(tasksTable.dueAt));

  const clients = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.teamId, teamId));
  const clientById = new Map(clients.map((c) => [c.id, c.name]));

  const withClientName = (t: (typeof pending)[number]) => ({
    ...t,
    clientName: t.clientId ? clientById.get(t.clientId) ?? null : null,
  });

  const overdueTasks = pending
    .filter((t) => t.dueAt.getTime() < now.getTime())
    .map(withClientName);

  const dueSoonTasks = pending
    .filter(
      (t) =>
        t.dueAt.getTime() >= now.getTime() &&
        t.dueAt.getTime() <= dueSoonThreshold.getTime(),
    )
    .map(withClientName);

  res.json(GetNotificationsResponse.parse({ overdueTasks, dueSoonTasks }));
});

export default router;
