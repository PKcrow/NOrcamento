import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  clientsTable,
  tasksTable,
  taskPhotosTable,
  teamsTable,
} from "@workspace/db";
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
  CreateTaskFeedbackLinkParams,
  CreateTaskFeedbackLinkResponse,
  GetPublicTaskFeedbackParams,
  GetPublicTaskFeedbackResponse,
  RespondPublicTaskFeedbackParams,
  RespondPublicTaskFeedbackBody,
  RespondPublicTaskFeedbackResponse,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";
import {
  findSchedulingConflict,
  getScheduleRangeError,
  withTeamScheduleLock,
} from "../lib/scheduling";
import { sendTaskReminderPushNotification } from "../lib/expoPush";

const router: IRouter = Router();

async function withClientNameSingle(task: typeof tasksTable.$inferSelect) {
  const photos = await db
    .select()
    .from(taskPhotosTable)
    .where(eq(taskPhotosTable.taskId, task.id));
  let clientName: string | null = null;
  if (task.clientId) {
    const [client] = await db
      .select({ name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.id, task.clientId));
    clientName = client?.name ?? null;
  }
  return {
    ...task,
    paidAmount: task.paidAmount ? Number(task.paidAmount) : null,
    clientName,
    photos,
  };
}

function enrichTaskWithClientName(task: typeof tasksTable.$inferSelect, photos: (typeof taskPhotosTable.$inferSelect)[], clientMap: Map<number, string>) {
  return {
    ...task,
    paidAmount: task.paidAmount ? Number(task.paidAmount) : null,
    clientName: task.clientId ? (clientMap.get(task.clientId) ?? null) : null,
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

  // Batch-fetch photos and client names to avoid N+1 queries
  const taskIds = tasks.map((t) => t.id);
  const allPhotos = taskIds.length > 0
    ? await db.select().from(taskPhotosTable).where(inArray(taskPhotosTable.taskId, taskIds))
    : [];
  const photosByTask = new Map<number, (typeof taskPhotosTable.$inferSelect)[]>();
  for (const photo of allPhotos) {
    const list = photosByTask.get(photo.taskId) ?? [];
    list.push(photo);
    photosByTask.set(photo.taskId, list);
  }

  const clientIds = [...new Set(tasks.map((t) => t.clientId).filter((id): id is number => id != null))];
  const clientRows = clientIds.length > 0
    ? await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds))
    : [];
  const clientMap = new Map(clientRows.map((c) => [c.id, c.name]));

  let results = tasks.map((task) =>
    enrichTaskWithClientName(task, photosByTask.get(task.id) ?? [], clientMap)
  );

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
  if (!endAt) {
    res.status(400).json({ error: "Data de término é obrigatória" });
    return;
  }

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

  // Notify team members about the new task
  void sendTaskReminderPushNotification({
    teamId,
    taskId: task.id,
    taskTitle: task.title,
    dueAt: task.dueAt,
    endAt: task.endAt,
    action: "created",
  });

  res.status(201).json(CreateTaskResponse.parse(await withClientNameSingle(task)));
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

  if (
    body.paidAmount !== undefined &&
    body.paidAmount !== null &&
    (!Number.isFinite(body.paidAmount) || body.paidAmount <= 0)
  ) {
    res.status(400).json({ error: "O valor pago deve ser maior que zero" });
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
    if (!effectiveEndAt) {
      res.status(400).json({ error: "Data de término é obrigatória" });
      return;
    }
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
    ...(body.status &&
    body.status !== "completed" &&
    body.status !== "paid" &&
    existing.feedbackToken
      ? {
          feedbackToken: null,
          feedbackSubmittedAt: null,
          feedbackRating: null,
          feedbackComment: null,
        }
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

  // Notify team members when the schedule changed (created/rescheduled)
  const scheduleChanged =
    body.dueAt !== undefined ||
    body.endAt !== undefined ||
    body.status === "scheduled";
  if (scheduleChanged) {
    void sendTaskReminderPushNotification({
      teamId,
      taskId: updated.id,
      taskTitle: updated.title,
      dueAt: updated.dueAt,
      endAt: updated.endAt,
      action: "rescheduled",
    });
  }

  const paymentPendingStatusChanged =
    effectiveStatus === "completed" && existing.status !== "completed";
  const paymentRecordedRequested =
    effectiveStatus === "paid" &&
    (existing.status !== "paid" || body.status === "paid");
  if (paymentPendingStatusChanged || paymentRecordedRequested) {
    void sendTaskReminderPushNotification({
      teamId,
      taskId: updated.id,
      taskTitle: updated.title,
      dueAt: updated.dueAt,
      endAt: updated.endAt,
      action:
        paymentPendingStatusChanged
          ? "payment_pending"
          : "payment_recorded",
    });
  }

  res.json(UpdateTaskResponse.parse(await withClientNameSingle(updated)));
});

router.post(
  "/tasks/:id/feedback-link",
  requireAuth,
  requireTeam,
  async (req, res) => {
    const { id } = CreateTaskFeedbackLinkParams.parse(req.params);
    const teamId = req.localUser!.teamId!;
    const [existing] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.teamId, teamId)));

    if (!existing) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    if (existing.status !== "completed" && existing.status !== "paid") {
      res
        .status(409)
        .json({ error: "O feedback só pode ser solicitado após concluir a O.S." });
      return;
    }

    const feedbackToken =
      existing.feedbackToken && !existing.feedbackSubmittedAt
        ? existing.feedbackToken
        : randomBytes(24).toString("hex");
    const [updated] = await db
      .update(tasksTable)
      .set({
        feedbackToken,
        feedbackSubmittedAt: null,
        feedbackRating: null,
        feedbackComment: null,
      })
      .where(eq(tasksTable.id, id))
      .returning();

    res.json(
      CreateTaskFeedbackLinkResponse.parse({
        taskId: updated.id,
        feedbackToken: updated.feedbackToken,
        feedbackSubmittedAt: updated.feedbackSubmittedAt,
        feedbackRating: updated.feedbackRating,
        feedbackComment: updated.feedbackComment,
      }),
    );
  },
);

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

  await db.transaction(async (tx) => {
    await tx.delete(taskPhotosTable).where(eq(taskPhotosTable.taskId, id));
    await tx.delete(tasksTable).where(eq(tasksTable.id, id));
  });
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

router.get("/public/feedback/:token", async (req, res) => {
  const { token } = GetPublicTaskFeedbackParams.parse(req.params);
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.feedbackToken, token),
        isNull(tasksTable.feedbackSubmittedAt),
      ),
    );
  if (!task) {
    res.status(404).json({ error: "Link de feedback não encontrado ou já respondido" });
    return;
  }

  const [client] = task.clientId
    ? await db
        .select({ name: clientsTable.name })
        .from(clientsTable)
        .where(eq(clientsTable.id, task.clientId))
    : [];
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, task.teamId));

  res.json(
    GetPublicTaskFeedbackResponse.parse({
      task: {
        id: task.id,
        title: task.title,
        clientName: client?.name ?? null,
        status: task.status,
      },
      company: team
        ? {
            id: team.id,
            name: team.name,
            logoUrl: team.logoUrl,
            phone: team.phone,
            email: team.email,
            address: team.address,
            createdAt: team.createdAt,
          }
        : null,
    }),
  );
});

router.post("/public/feedback/:token", async (req, res) => {
  const { token } = RespondPublicTaskFeedbackParams.parse(req.params);
  const body = RespondPublicTaskFeedbackBody.parse(req.body);
  const [updated] = await db
    .update(tasksTable)
    .set({
      feedbackRating: body.rating,
      feedbackComment: body.comment?.trim() || null,
      feedbackSubmittedAt: new Date(),
    })
    .where(
      and(
        eq(tasksTable.feedbackToken, token),
        isNull(tasksTable.feedbackSubmittedAt),
      ),
    )
    .returning({
      id: tasksTable.id,
      rating: tasksTable.feedbackRating,
      comment: tasksTable.feedbackComment,
      submittedAt: tasksTable.feedbackSubmittedAt,
    });

  if (!updated) {
    res.status(404).json({ error: "Link de feedback não encontrado ou já respondido" });
    return;
  }

  res.json(
    RespondPublicTaskFeedbackResponse.parse({
      taskId: updated.id,
      rating: updated.rating,
      comment: updated.comment,
      submittedAt: updated.submittedAt,
    }),
  );
});

export default router;
