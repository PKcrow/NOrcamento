import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, ilike, isNull, or, sql } from "drizzle-orm";
import {
  db,
  clientsTable,
  quotesTable,
  quoteItemsTable,
  tasksTable,
  taskPhotosTable,
  teamsTable,
  type Quote,
  type QuoteItem,
} from "@workspace/db";
import {
  ListQuotesQueryParams,
  ListQuotesResponse,
  CreateQuoteBody,
  CreateQuoteResponse,
  GetQuoteParams,
  GetQuoteResponse,
  UpdateQuoteParams,
  UpdateQuoteBody,
  UpdateQuoteResponse,
  DeleteQuoteParams,
  ShareQuoteParams,
  ShareQuoteResponse,
  GetPublicQuoteParams,
  GetPublicQuoteResponse,
  RespondPublicQuoteParams,
  RespondPublicQuoteBody,
  RespondPublicQuoteResponse,
  ConvertQuoteToTaskParams,
  ConvertQuoteToTaskBody,
  ConvertQuoteToTaskResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requireTeam,
  requireTeamOwner,
} from "../middlewares/auth";
import { sendQuoteResponsePushNotification } from "../lib/expoPush";
import {
  findSchedulingConflict,
  getScheduleRangeError,
  withTeamScheduleLock,
} from "../lib/scheduling";

const router: IRouter = Router();
const PUBLIC_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function quoteWithTotal(
  quote: Quote,
  clientName: string,
  items: QuoteItem[],
) {
  const itemsOut = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    return {
      id: item.id,
      productId: item.productId,
      description: item.description,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };
  });
  const laborCost = Number(quote.laborCost);
  const total = itemsOut.reduce((sum, item) => sum + item.total, 0) + laborCost;

  return {
    id: quote.id,
    clientId: quote.clientId,
    clientName,
    status: quote.status,
    serviceScopeEnabled: quote.serviceScopeEnabled,
    serviceDescription: quote.serviceDescription,
    notes: quote.notes,
    laborCost,
    total,
    items: itemsOut,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    sentAt: quote.sentAt,
    publicToken: quote.publicToken,
    publicLinkExpiresAt: quote.publicLinkExpiresAt,
    publicLinkRevokedAt: quote.publicLinkRevokedAt,
    clientResponseNote: quote.clientResponseNote,
    respondedAt: quote.respondedAt,
  };
}

async function taskWithClientName(task: typeof tasksTable.$inferSelect) {
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

function taskDescriptionFromQuote(
  quote: Quote,
  items: QuoteItem[],
  total: number,
) {
  const currency = (amount: number) =>
    amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const lines: string[] = [];

  if (quote.serviceScopeEnabled && quote.serviceDescription?.trim()) {
    lines.push(quote.serviceDescription.trim(), "");
  }
  if (items.length > 0) {
    lines.push("Itens:");
    for (const item of items) {
      lines.push(
        `- ${item.description} (${Number(item.quantity)}x ${currency(Number(item.unitPrice))})`,
      );
    }
  }
  if (Number(quote.laborCost) > 0) {
    lines.push(`- Mão de obra: ${currency(Number(quote.laborCost))}`);
  }
  lines.push("", `Total aprovado: ${currency(total)}`);
  if (quote.notes?.trim()) {
    lines.push("", `Observações: ${quote.notes.trim()}`);
  }

  return lines.join("\n");
}

function isUniqueConstraintError(error: unknown) {
  let current = error;
  const seen = new Set<object>();

  while (typeof current === "object" && current !== null) {
    if (seen.has(current)) return false;
    seen.add(current);

    const databaseError = current as { code?: unknown; cause?: unknown };
    if (databaseError.code === "23505") return true;
    current = databaseError.cause;
  }

  return false;
}

function isPublicLinkActive(
  quote: Pick<
    Quote,
    "publicToken" | "publicLinkExpiresAt" | "publicLinkRevokedAt"
  >,
  now = new Date(),
) {
  return Boolean(
    quote.publicToken &&
      quote.publicLinkExpiresAt &&
      !quote.publicLinkRevokedAt &&
      quote.publicLinkExpiresAt.getTime() > now.getTime(),
  );
}

async function loadQuote(quoteId: number, teamId: string) {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.teamId, teamId)));
  if (!quote) return null;

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, quote.clientId));

  const items = await db
    .select()
    .from(quoteItemsTable)
    .where(eq(quoteItemsTable.quoteId, quoteId));

  const [convertedTask] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.quoteId, quoteId));

  return {
    ...quoteWithTotal(quote, client?.name ?? "Cliente removido", items),
    convertedTaskId: convertedTask?.id ?? null,
  };
}

router.get("/quotes", requireAuth, requireTeam, async (req, res) => {
  const { status, clientId, search } = ListQuotesQueryParams.parse(req.query);
  const teamId = req.localUser!.teamId!;

  const conditions = [eq(quotesTable.teamId, teamId)];
  if (status) conditions.push(eq(quotesTable.status, status));
  if (clientId) conditions.push(eq(quotesTable.clientId, clientId));
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const numeric = Number.parseInt(search.trim(), 10);
    const searchConditions = [ilike(clientsTable.name, term)];
    if (!Number.isNaN(numeric)) {
      searchConditions.push(eq(quotesTable.id, numeric));
    }
    conditions.push(or(...searchConditions)!);
  }

  const quotes = await db
    .select({ quote: quotesTable })
    .from(quotesTable)
    .innerJoin(clientsTable, eq(quotesTable.clientId, clientsTable.id))
    .where(and(...conditions))
    .orderBy(desc(quotesTable.createdAt))
    .then((rows) => rows.map((r) => r.quote));

  const results = await Promise.all(
    quotes.map((q) => loadQuote(q.id, teamId)),
  );

  res.json(ListQuotesResponse.parse(results.filter(Boolean)));
});

router.post("/quotes", requireAuth, requireTeam, async (req, res) => {
  const body = CreateQuoteBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

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

  const [quote] = await db
    .insert(quotesTable)
    .values({
      teamId,
      clientId: body.clientId,
      status: body.status ?? "draft",
      serviceScopeEnabled: body.serviceScopeEnabled ?? false,
      serviceDescription: body.serviceDescription ?? null,
      notes: body.notes ?? null,
      laborCost: String(body.laborCost ?? 0),
      sentAt: body.status === "sent" ? new Date() : null,
    })
    .returning();

  if (body.items.length > 0) {
    await db.insert(quoteItemsTable).values(
      body.items.map((item) => ({
        quoteId: quote.id,
        productId: item.productId ?? null,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })),
    );
  }

  const result = await loadQuote(quote.id, teamId);
  res.status(201).json(CreateQuoteResponse.parse(result));
});

router.get("/quotes/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = GetQuoteParams.parse(req.params);
  const teamId = req.localUser!.teamId!;

  const result = await loadQuote(id, teamId);
  if (!result) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }
  res.json(GetQuoteResponse.parse(result));
});

router.patch("/quotes/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = UpdateQuoteParams.parse(req.params);
  const body = UpdateQuoteBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, id), eq(quotesTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }

  if (body.clientId !== undefined) {
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

  const becameSent = body.status === "sent" && existing.status !== "sent";
  // Attribute internal approvals/rejections to a timestamp too, so reports
  // can rely on respondedAt regardless of who answered.
  const becameAnswered =
    (body.status === "approved" || body.status === "rejected") &&
    body.status !== existing.status;

  await db
    .update(quotesTable)
    .set({
      ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.serviceScopeEnabled !== undefined
        ? { serviceScopeEnabled: body.serviceScopeEnabled }
        : {}),
      ...(body.serviceDescription !== undefined
        ? { serviceDescription: body.serviceDescription }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.laborCost !== undefined
        ? { laborCost: String(body.laborCost) }
        : {}),
      ...(becameSent ? { sentAt: new Date() } : {}),
      ...(becameAnswered ? { respondedAt: new Date() } : {}),
    })
    .where(eq(quotesTable.id, id));

  if (body.items !== undefined) {
    await db.delete(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
    if (body.items.length > 0) {
      await db.insert(quoteItemsTable).values(
        body.items.map((item) => ({
          quoteId: id,
          productId: item.productId ?? null,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        })),
      );
    }
  }

  const result = await loadQuote(id, teamId);
  res.json(UpdateQuoteResponse.parse(result));
});

router.delete("/quotes/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = DeleteQuoteParams.parse(req.params);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, id), eq(quotesTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }

  const [convertedTask] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.quoteId, id));
  if (convertedTask) {
    res.status(409).json({
      error: "Este orçamento já possui uma ordem de serviço vinculada e não pode ser excluído.",
    });
    return;
  }

  await db.delete(quotesTable).where(eq(quotesTable.id, id));
  res.status(204).send();
});

// POST /quotes/:id/share — generate (or reuse) a 30-day public approval link
router.post("/quotes/:id/share", requireAuth, requireTeam, async (req, res) => {
  const { id } = ShareQuoteParams.parse(req.params);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, id), eq(quotesTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }

  const now = new Date();
  if (!isPublicLinkActive(existing, now)) {
    const token = randomBytes(24).toString("base64url");
    await db
      .update(quotesTable)
      .set({
        publicToken: token,
        publicLinkExpiresAt: new Date(now.getTime() + PUBLIC_LINK_TTL_MS),
        publicLinkRevokedAt: null,
        // Sharing implies sending: move drafts to "sent"
        ...(existing.status === "draft"
          ? { status: "sent" as const, sentAt: new Date() }
          : {}),
      })
      .where(eq(quotesTable.id, id));
  }

  const result = await loadQuote(id, teamId);
  res.json(ShareQuoteResponse.parse(result));
});

// POST /quotes/:id/revoke-link — owners can disable a public approval link
router.post(
  "/quotes/:id/revoke-link",
  requireAuth,
  requireTeam,
  requireTeamOwner,
  async (req, res) => {
    const { id } = ShareQuoteParams.parse(req.params);
    const teamId = req.localUser!.teamId!;

    const [existing] = await db
      .select()
      .from(quotesTable)
      .where(and(eq(quotesTable.id, id), eq(quotesTable.teamId, teamId)));
    if (!existing) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    if (existing.publicToken && !existing.publicLinkRevokedAt) {
      await db
        .update(quotesTable)
        .set({ publicLinkRevokedAt: new Date() })
        .where(eq(quotesTable.id, id));
    }

    const result = await loadQuote(id, teamId);
    res.json(ShareQuoteResponse.parse(result));
  },
);

// POST /quotes/:id/convert-to-task — atomically create (or return) the sole
// scheduled task linked to an approved quote.
router.post(
  "/quotes/:id/convert-to-task",
  requireAuth,
  requireTeam,
  async (req, res) => {
    const { id } = ConvertQuoteToTaskParams.parse(req.params);
    const body = ConvertQuoteToTaskBody.parse(req.body);
    const teamId = req.localUser!.teamId!;

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(and(eq(quotesTable.id, id), eq(quotesTable.teamId, teamId)));
    if (!quote) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    const [alreadyLinked] = await db
      .select()
      .from(tasksTable)
      .where(
        and(eq(tasksTable.teamId, teamId), eq(tasksTable.quoteId, quote.id)),
      );
    if (alreadyLinked) {
      res.json(
        ConvertQuoteToTaskResponse.parse(await taskWithClientName(alreadyLinked)),
      );
      return;
    }

    if (quote.status !== "approved") {
      res.status(409).json({
        error: "Apenas orçamentos aprovados podem ser agendados.",
      });
      return;
    }

    const dueAt = new Date(body.dueAt);
    const endAt = body.endAt ? new Date(body.endAt) : null;
    const rangeError = getScheduleRangeError(dueAt, endAt);
    if (rangeError) {
      res.status(400).json({
        error: rangeError,
      });
      return;
    }
    if (!endAt) return;

    const items = await db
      .select()
      .from(quoteItemsTable)
      .where(eq(quoteItemsTable.quoteId, quote.id));
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(
        and(eq(clientsTable.id, quote.clientId), eq(clientsTable.teamId, teamId)),
      );
    if (!client) {
      res.status(409).json({
        error: "O cliente deste orçamento não está mais disponível.",
      });
      return;
    }
    const total =
      items.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
        0,
      ) + Number(quote.laborCost);

    try {
      const result = await withTeamScheduleLock(teamId, async (tx) => {
        const [linkedTask] = await tx
          .select()
          .from(tasksTable)
          .where(
            and(
              eq(tasksTable.teamId, teamId),
              eq(tasksTable.quoteId, quote.id),
            ),
          );
        if (linkedTask) return { task: linkedTask, alreadyLinked: true };

        const conflict = await findSchedulingConflict(teamId, dueAt, endAt, undefined, tx);
        if (conflict) throw new Error(conflict);

        const [created] = await tx
          .insert(tasksTable)
          .values({
            teamId,
            quoteId: quote.id,
            clientId: quote.clientId,
            title: `O.S. – ${client.name} (Orc. #${quote.id.toString().padStart(4, "0")})`,
            description: taskDescriptionFromQuote(quote, items, total),
            dueAt,
            endAt,
          })
          .returning();
        return { task: created, alreadyLinked: false };
      });

      res
        .status(result.alreadyLinked ? 200 : 201)
        .json(
          ConvertQuoteToTaskResponse.parse(await taskWithClientName(result.task)),
        );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const [linkedTask] = await db
          .select()
          .from(tasksTable)
          .where(
            and(
              eq(tasksTable.teamId, teamId),
              eq(tasksTable.quoteId, quote.id),
            ),
          );
        if (linkedTask) {
          res.json(
            ConvertQuoteToTaskResponse.parse(
              await taskWithClientName(linkedTask),
            ),
          );
          return;
        }
      }
      if (error instanceof Error) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  },
);

async function loadPublicQuoteRecord(quote: Quote) {
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, quote.clientId));
  const items = await db
    .select()
    .from(quoteItemsTable)
    .where(eq(quoteItemsTable.quoteId, quote.id));
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, quote.teamId));
  const [convertedTask] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.quoteId, quote.id));

  return {
    quote: {
      ...quoteWithTotal(quote, client?.name ?? "Cliente", items),
      convertedTaskId: convertedTask?.id ?? null,
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
  };
}

async function loadPublicQuote(token: string) {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.publicToken, token));
  if (!quote || !isPublicLinkActive(quote)) return null;
  return loadPublicQuoteRecord(quote);
}

// PUBLIC (no auth): view a quote by its public token
router.get("/public/quotes/:token", async (req, res) => {
  const { token } = GetPublicQuoteParams.parse(req.params);
  const result = await loadPublicQuote(token);
  if (!result) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }
  res.json(GetPublicQuoteResponse.parse(result));
});

// PUBLIC (no auth): approve a quote by its public token
router.post("/public/quotes/:token/respond", async (req, res) => {
  const { token } = RespondPublicQuoteParams.parse(req.params);
  const body = RespondPublicQuoteBody.parse(req.body);

  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.publicToken, token));
  if (!quote) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }

  const now = new Date();
  if (!isPublicLinkActive(quote, now)) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }

  if (quote.status !== "sent") {
    res.status(409).json({
      error:
        quote.status === "approved" || quote.status === "rejected"
          ? "Este orçamento já foi respondido e não pode ser alterado"
          : "Este orçamento não está disponível para resposta",
    });
    return;
  }

  // Atomic conditional update: only a quote still in "sent" can be answered,
  // so concurrent responses cannot both win.
  const [updated] = await db
    .update(quotesTable)
    .set({
      status: body.action,
      clientResponseNote: body.note?.trim() ? body.note.trim() : null,
      respondedAt: new Date(),
    })
    .where(
      and(
        eq(quotesTable.id, quote.id),
        eq(quotesTable.status, "sent"),
        isNull(quotesTable.publicLinkRevokedAt),
        // Use database time so the expiry check and state transition happen
        // in the same atomic operation.
        gt(quotesTable.publicLinkExpiresAt, sql`now()`),
      ),
    )
    .returning();
  if (!updated) {
    const [latest] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.publicToken, token));
    if (!latest || !isPublicLinkActive(latest)) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }
    res.status(409).json({ error: "Este orçamento já foi respondido" });
    return;
  }

  // The response was accepted while the link was active. Build its payload
  // from that accepted row so a concurrent revocation cannot turn this
  // successful response into a 500 during a second public-link lookup.
  const result = await loadPublicQuoteRecord(updated);
  // Delivery is deliberately detached from the public response: a push outage
  // must never make the customer retry or lose an accepted decision.
  void sendQuoteResponsePushNotification({
    teamId: updated.teamId,
    quoteId: updated.id,
    clientName: result.quote.clientName,
    status: body.action,
  });
  res.json(RespondPublicQuoteResponse.parse(result));
});

export default router;
