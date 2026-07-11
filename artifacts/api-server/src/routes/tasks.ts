import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, clientsTable, tasksTable } from "@workspace/db";
import {
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskBody,
  CreateTaskResponse,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

async function withClientName(task: typeof tasksTable.$inferSelect) {
  if (!task.clientId) return { ...task, clientName: null };
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, task.clientId));
  return { ...task, clientName: client?.name ?? null };
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

  const [task] = await db
    .insert(tasksTable)
    .values({
      teamId,
      title: body.title,
      description: body.description ?? null,
      dueAt: body.dueAt,
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

  const [updated] = await db
    .update(tasksTable)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.dueAt !== undefined ? { dueAt: body.dueAt } : {}),
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

export default router;
