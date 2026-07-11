import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, clientsTable, quotesTable, quoteItemsTable, tasksTable } from "@workspace/db";
import {
  ListClientsQueryParams,
  ListClientsResponse,
  CreateClientBody,
  CreateClientResponse,
  GetClientParams,
  GetClientResponse,
  UpdateClientParams,
  UpdateClientBody,
  UpdateClientResponse,
  DeleteClientParams,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";
import { quoteWithTotal } from "./quotes";

const router: IRouter = Router();

router.get("/clients", requireAuth, requireTeam, async (req, res) => {
  const { search } = ListClientsQueryParams.parse(req.query);
  const teamId = req.localUser!.teamId!;

  const conditions = [eq(clientsTable.teamId, teamId)];
  if (search) {
    conditions.push(
      or(
        ilike(clientsTable.name, `%${search}%`),
        ilike(clientsTable.email, `%${search}%`),
        ilike(clientsTable.phone, `%${search}%`),
      )!,
    );
  }

  const clients = await db
    .select()
    .from(clientsTable)
    .where(and(...conditions))
    .orderBy(desc(clientsTable.createdAt));

  res.json(ListClientsResponse.parse(clients));
});

router.post("/clients", requireAuth, requireTeam, async (req, res) => {
  const body = CreateClientBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  const [client] = await db
    .insert(clientsTable)
    .values({
      teamId,
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      notes: body.notes ?? null,
    })
    .returning();

  res.status(201).json(CreateClientResponse.parse(client));
});

router.get("/clients/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = GetClientParams.parse(req.params);
  const teamId = req.localUser!.teamId!;

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.teamId, teamId)));

  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }

  const quoteRows = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.clientId, id), eq(quotesTable.teamId, teamId)))
    .orderBy(desc(quotesTable.createdAt));

  const quotes = await Promise.all(
    quoteRows.map(async (q) => {
      const items = await db
        .select()
        .from(quoteItemsTable)
        .where(eq(quoteItemsTable.quoteId, q.id));
      return quoteWithTotal(q, client.name, items);
    }),
  );

  const taskRows = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.clientId, id), eq(tasksTable.teamId, teamId)))
    .orderBy(desc(tasksTable.dueAt));

  const tasks = taskRows.map((t) => ({ ...t, clientName: client.name }));

  res.json(
    GetClientResponse.parse({
      ...client,
      quotes,
      tasks,
    }),
  );
});

router.patch("/clients/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = UpdateClientParams.parse(req.params);
  const body = UpdateClientBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }

  const [updated] = await db
    .update(clientsTable)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    })
    .where(eq(clientsTable.id, id))
    .returning();

  res.json(UpdateClientResponse.parse(updated));
});

router.delete("/clients/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = DeleteClientParams.parse(req.params);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }

  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  res.status(204).send();
});

export default router;
