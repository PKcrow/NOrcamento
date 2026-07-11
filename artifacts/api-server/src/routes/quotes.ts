import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  clientsTable,
  quotesTable,
  quoteItemsTable,
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
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

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
  const total = itemsOut.reduce((sum, item) => sum + item.total, 0);

  return {
    id: quote.id,
    clientId: quote.clientId,
    clientName,
    status: quote.status,
    notes: quote.notes,
    total,
    items: itemsOut,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    sentAt: quote.sentAt,
  };
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

  return quoteWithTotal(quote, client?.name ?? "Cliente removido", items);
}

router.get("/quotes", requireAuth, requireTeam, async (req, res) => {
  const { status, clientId } = ListQuotesQueryParams.parse(req.query);
  const teamId = req.localUser!.teamId!;

  const conditions = [eq(quotesTable.teamId, teamId)];
  if (status) conditions.push(eq(quotesTable.status, status));
  if (clientId) conditions.push(eq(quotesTable.clientId, clientId));

  const quotes = await db
    .select()
    .from(quotesTable)
    .where(and(...conditions))
    .orderBy(desc(quotesTable.createdAt));

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
      notes: body.notes ?? null,
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

  await db
    .update(quotesTable)
    .set({
      ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(becameSent ? { sentAt: new Date() } : {}),
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

  await db.delete(quotesTable).where(eq(quotesTable.id, id));
  res.status(204).send();
});

export default router;
