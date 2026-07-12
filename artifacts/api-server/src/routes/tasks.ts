import { Router, type IRouter } from "express";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, clientsTable, tasksTable, taskPhotosTable } from "@workspace/db";
import {
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskBody,
  CreateTaskResponse,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
  AddTaskPhotoParams,
  AddTaskPhotoBody,
  AddTaskPhotoResponse,
  DeleteTaskPhotoParams,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

async function withClientName(task: typeof tasksTable.$inferSelect) {
  const photos = await db
    .select()
    .from(taskPhotosTable)
    .where(eq(taskPhotosTable.taskId, task.id));

  if (!task.clientId) return { ...task, clientName: null, photos };
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, task.clientId));
  return { ...task, clientName: client?.name ?? null, photos };
}

function dayOnly(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Returns a conflict message if another pending task in the team already
 * occupies any day within [dueAt, endAt ?? dueAt], excluding `excludeTaskId`.
 */
async function findSchedulingConflict(
  teamId: string,
  dueAt: Date,
  endAt: Date | null,
  excludeTaskId?: number,
): Promise<string | null> {
  const newStart = dayOnly(dueAt);
  const newEnd = dayOnly(endAt ?? dueAt);

  const conditions = [
    eq(tasksTable.teamId, teamId),
    eq(tasksTable.status, "pending"),
  ];
  if (excludeTaskId !== undefined) {
    conditions.push(ne(tasksTable.id, excludeTaskId));
  }

  const existingTasks = await db
    .select()
    .from(tasksTable)
    .where(and(...conditions));

  for (const existing of existingTasks) {
    const existingStart = dayOnly(existing.dueAt);
    const existingEnd = dayOnly(existing.endAt ?? existing.dueAt);
    if (newStart <= existingEnd && existingStart <= newEnd) {
      return `Já existe um serviço agendado para essa data (${existing.title}). Escolha outro dia.`;
    }
  }

  return null;
}

router.get("/tasks", requireAuth, requireTeam, async (req, res) => {
  const { status } = ListTasksQueryParams.parse(req.query);
  const teamId = req.localUser!.teamId!;

  const conditions = [eq(tasksTable.teamId, teamId)];
  if (status) conditions.push(eq(tasksTable.status, status));

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(...conditions))
    .orderBy(asc(tasksTable.dueAt));

  const results = await Promise.all(tasks.map(withClientName));
  res.json(ListTasksResponse.parse(results));
});

router.post("/tasks", requireAuth, requireTeam, async (req, res) => {
  const body = CreateTaskBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  if (body.clientId) {
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(
        and(eq(clientsTable.id, body.clientId), eq(clientsTable.teamId, teamId)),
      );
    if (!client) {
      res.status(400).json({ error: "Cliente inválido" });
      return;
    }
  }

  const conflict = await findSchedulingConflict(
    teamId,
    new Date(body.dueAt),
    body.endAt ? new Date(body.endAt) : null,
  );
  if (conflict) {
    res.status(409).json({ error: conflict });
    return;
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      teamId,
      title: body.title,
      description: body.description ?? null,
      dueAt: body.dueAt,
      endAt: body.endAt ?? null,
      clientId: body.clientId ?? null,
    })
    .returning();

  res.status(201).json(CreateTaskResponse.parse(await withClientName(task)));
});

router.patch("/tasks/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = UpdateTaskParams.parse(req.params);
  const body = UpdateTaskBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }

  if (body.clientId) {
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(
        and(eq(clientsTable.id, body.clientId), eq(clientsTable.teamId, teamId)),
      );
    if (!client) {
      res.status(400).json({ error: "Cliente inválido" });
      return;
    }
  }

  const effectiveStatus = body.status ?? existing.status;
  const effectiveDueAt = body.dueAt ? new Date(body.dueAt) : existing.dueAt;
  const effectiveEndAt =
    body.endAt !== undefined
      ? body.endAt
        ? new Date(body.endAt)
        : null
      : existing.endAt;

  if (
    effectiveStatus === "pending" &&
    (body.dueAt !== undefined || body.endAt !== undefined || body.status !== undefined)
  ) {
    const conflict = await findSchedulingConflict(
      teamId,
      effectiveDueAt,
      effectiveEndAt,
      id,
    );
    if (conflict) {
      res.status(409).json({ error: conflict });
      return;
    }
  }

  const [updated] = await db
    .update(tasksTable)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.dueAt !== undefined ? { dueAt: body.dueAt } : {}),
      ...(body.endAt !== undefined ? { endAt: body.endAt } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
    })
    .where(eq(tasksTable.id, id))
    .returning();

  res.json(UpdateTaskResponse.parse(await withClientName(updated)));
});

router.delete("/tasks/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = DeleteTaskParams.parse(req.params);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

router.post("/tasks/:id/photos", requireAuth, requireTeam, async (req, res) => {
  const { id } = AddTaskPhotoParams.parse(req.params);
  const body = AddTaskPhotoBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }

  const [photo] = await db
    .insert(taskPhotosTable)
    .values({ taskId: id, url: body.url })
    .returning();

  res.status(201).json(AddTaskPhotoResponse.parse(photo));
});

router.delete(
  "/tasks/:id/photos/:photoId",
  requireAuth,
  requireTeam,
  async (req, res) => {
    const { id, photoId } = DeleteTaskPhotoParams.parse(req.params);
    const teamId = req.localUser!.teamId!;

    const [existing] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.teamId, teamId)));
    if (!existing) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }

    const [photo] = await db
      .select()
      .from(taskPhotosTable)
      .where(
        and(eq(taskPhotosTable.id, photoId), eq(taskPhotosTable.taskId, id)),
      );
    if (!photo) {
      res.status(404).json({ error: "Foto não encontrada" });
      return;
    }

    await db.delete(taskPhotosTable).where(eq(taskPhotosTable.id, photoId));
    res.status(204).send();
  },
);

export default router;
