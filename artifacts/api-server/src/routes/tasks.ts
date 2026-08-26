import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, or } from "drizzle-orm";
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
import {
  findSchedulingConflict,
  getScheduleRangeError,
  withTeamScheduleLock,
} from "../lib/scheduling";

const router: IRouter = Router();

async function withClientName(task: typeof tasksTable.$inferSelect) {
  const photos = await db
    .select()
    .from(taskPhotosTable)
    .where(eq(taskPhotosTable.taskId, task.id));

  if (!task.clientId) {
    return {
      ...task,
      paidAmount: task.paidAmount ? Number(task.paidAmount) : null,
      clientName: null,
      photos,
    };
  }
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, task.clientId));
  return {
    ...task,
    paidAmount: task.paidAmount ? Number(task.paidAmount) : null,
    clientName: client?.name ?? null,
    photos,
  };
}

router.get("/tasks", requireAuth, requireTeam, async (req, res) => {
  const { status, search } = ListTasksQueryParams.parse(req.query);
  const teamId = req.localUser!.teamId!;

  const conditions = [eq(tasksTable.teamId, teamId)];
  if (status) conditions.push(eq(tasksTable.status, status));

  let tasks = await db
    .select()
    .from(tasksTable)
    .where(and(...conditions))
    .orderBy(asc(tasksTable.dueAt));

  // Client-side search filtering (join clientName after fetch)
  let results = await Promise.all(tasks.map(withClientName));

  if (search) {
    const term = search.toLowerCase();
    results = results.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        (t.clientName?.toLowerCase().includes(term) ?? false) ||
        (t.description?.toLowerCase().includes(term) ?? false),
    );
  }

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

  const dueAt = new Date(body.dueAt);
  const endAt = body.endAt ? new Date(body.endAt) : null;
  const rangeError = getScheduleRangeError(dueAt, endAt);
  if (rangeError) {
    res.status(400).json({ error: rangeError });
    return;
  }
  if (!endAt) return;

  let task: typeof tasksTable.$inferSelect;
  try {
    task = await withTeamScheduleLock(teamId, async (tx) => {
      const conflict = await findSchedulingConflict(teamId, dueAt, endAt, undefined, tx);
      if (conflict) throw new Error(conflict);

      const [created] = await tx
        .insert(tasksTable)
        .values({
          teamId,
          title: body.title,
          description: body.description ?? null,
          dueAt,
          endAt,
          clientId: body.clientId ?? null,
        })
        .returning();
      return created;
    });
  } catch (error) {
    res.status(409).json({
      error: error instanceof Error ? error.message : "Conflito de agenda.",
    });
    return;
  }

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

  const needsScheduleValidation =
    (effectiveStatus === "scheduled" || effectiveStatus === "in_progress") &&
    (body.dueAt !== undefined || body.endAt !== undefined || body.status !== undefined);
  if (needsScheduleValidation) {
    const rangeError = getScheduleRangeError(effectiveDueAt, effectiveEndAt);
    if (rangeError) {
      res.status(400).json({ error: rangeError });
      return;
    }
    if (!effectiveEndAt) return;
  }

  // Auto-set paidAt when marking as paid; clear payment info when un-paying
  const unpaying =
    body.status !== undefined &&
    body.status !== "paid" &&
    existing.status === "paid";
  const paidAt =
    body.paidAt !== undefined
      ? body.paidAt
      : body.status === "paid" && !existing.paidAt
        ? new Date().toISOString()
        : unpaying
          ? null
          : undefined;
  const paidAmount =
    body.paidAmount !== undefined ? body.paidAmount : unpaying ? null : undefined;

  const updateValues = {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.dueAt !== undefined ? { dueAt: body.dueAt } : {}),
    ...(body.endAt !== undefined ? { endAt: body.endAt } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
    ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
    ...(paidAmount !== undefined
      ? { paidAmount: paidAmount !== null ? String(paidAmount) : null }
      : {}),
  };

  let updated: typeof tasksTable.$inferSelect;
  if (needsScheduleValidation) {
    try {
      updated = await withTeamScheduleLock(teamId, async (tx) => {
        const conflict = await findSchedulingConflict(
          teamId,
          effectiveDueAt,
          effectiveEndAt!,
          id,
          tx,
        );
        if (conflict) throw new Error(conflict);
        const [saved] = await tx
          .update(tasksTable)
          .set(updateValues)
          .where(eq(tasksTable.id, id))
          .returning();
        return saved;
      });
    } catch (error) {
      res.status(409).json({
        error: error instanceof Error ? error.message : "Conflito de agenda.",
      });
      return;
    }
  } else {
    [updated] = await db
      .update(tasksTable)
      .set(updateValues)
      .where(eq(tasksTable.id, id))
      .returning();
  }

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
