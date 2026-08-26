import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  clientsTable,
  pushTokensTable,
  quotesTable,
  tasksTable,
  taskPhotosTable,
  teamMembershipsTable,
} from "@workspace/db";
import {
  GetNotificationsResponse,
  RegisterPushTokenBody,
  UnregisterPushTokenBody,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;
const QUOTE_RESPONSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

router.post("/push-tokens", requireAuth, async (req, res) => {
  const body = RegisterPushTokenBody.parse(req.body);
  const userId = req.localUser!.id;

  const memberships = await db
    .select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.userId, userId));

  if (memberships.length > 0) {
    await db
      .insert(pushTokensTable)
      .values(
        memberships.map(({ teamId }) => ({
          userId,
          teamId,
          expoPushToken: body.token,
          platform: body.platform,
        })),
      )
      .onConflictDoUpdate({
        target: [pushTokensTable.teamId, pushTokensTable.expoPushToken],
        set: {
          userId,
          platform: body.platform,
          updatedAt: new Date(),
        },
      });
  }

  res.status(204).send();
});

router.delete("/push-tokens", requireAuth, async (req, res) => {
  const body = UnregisterPushTokenBody.parse(req.body);
  await db
    .delete(pushTokensTable)
    .where(
      and(
        eq(pushTokensTable.userId, req.localUser!.id),
        eq(pushTokensTable.expoPushToken, body.token),
      ),
    );
  res.status(204).send();
});

router.get("/notifications", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;
  const now = new Date();
  const dueSoonThreshold = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
  const recentResponseThreshold = new Date(
    now.getTime() - QUOTE_RESPONSE_WINDOW_MS,
  );

  const pending = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.teamId, teamId),
        inArray(tasksTable.status, ["scheduled", "in_progress"]),
      ),
    )
    .orderBy(asc(tasksTable.dueAt));

  const clients = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.teamId, teamId));
  const clientById = new Map(clients.map((c) => [c.id, c.name]));

  const photos = await db.select().from(taskPhotosTable);
  const photosByTask = new Map<number, (typeof photos)[number][]>();
  for (const p of photos) {
    photosByTask.set(p.taskId, [...(photosByTask.get(p.taskId) ?? []), p]);
  }

  const withClientName = (t: (typeof pending)[number]) => ({
    ...t,
    clientName: t.clientId ? clientById.get(t.clientId) ?? null : null,
    photos: photosByTask.get(t.id) ?? [],
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

  const quoteResponses = await db
    .select({
      id: quotesTable.id,
      status: quotesTable.status,
      clientName: clientsTable.name,
      respondedAt: quotesTable.respondedAt,
    })
    .from(quotesTable)
    .innerJoin(clientsTable, eq(quotesTable.clientId, clientsTable.id))
    .where(
      and(
        eq(quotesTable.teamId, teamId),
        inArray(quotesTable.status, ["approved", "rejected"]),
        gte(quotesTable.respondedAt, recentResponseThreshold),
      ),
    )
    .orderBy(desc(quotesTable.respondedAt))
    .limit(10);

  res.json(
    GetNotificationsResponse.parse({
      overdueTasks,
      dueSoonTasks,
      quoteResponses,
    }),
  );
});

export default router;
