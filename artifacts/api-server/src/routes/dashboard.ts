import { Router, type IRouter } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  clientsTable,
  productsTable,
  quotesTable,
  quoteItemsTable,
  tasksTable,
  taskPhotosTable,
} from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";
import { quoteWithTotal } from "./quotes";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;

  const [clients, products, allQuotes, pendingTasks] = await Promise.all([
    db.select().from(clientsTable).where(eq(clientsTable.teamId, teamId)),
    db.select().from(productsTable).where(eq(productsTable.teamId, teamId)),
    db.select().from(quotesTable).where(eq(quotesTable.teamId, teamId)),
    db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.teamId, teamId), eq(tasksTable.status, "pending")))
      .orderBy(asc(tasksTable.dueAt))
      .limit(5),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c.name]));

  const pendingQuoteRows = allQuotes.filter(
    (q) => q.status === "draft" || q.status === "sent",
  );

  const recentQuoteRows = [...allQuotes]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const quotesNeeded = [
    ...new Map(
      [...pendingQuoteRows, ...recentQuoteRows].map((q) => [q.id, q]),
    ).values(),
  ];

  const itemsByQuote = new Map<number, (typeof quoteItemsTable.$inferSelect)[]>();
  for (const q of quotesNeeded) {
    const items = await db
      .select()
      .from(quoteItemsTable)
      .where(eq(quoteItemsTable.quoteId, q.id));
    itemsByQuote.set(q.id, items);
  }

  const withTotal = (q: (typeof quotesNeeded)[number]) =>
    quoteWithTotal(
      q,
      clientById.get(q.clientId) ?? "Cliente removido",
      itemsByQuote.get(q.id) ?? [],
    );

  const pendingQuotesTotal = pendingQuoteRows.reduce(
    (sum, q) => sum + withTotal(q).total,
    0,
  );

  const recentQuotes = recentQuoteRows.map(withTotal);

  const taskPhotos =
    pendingTasks.length > 0
      ? await db
          .select()
          .from(taskPhotosTable)
          .where(
            inArray(taskPhotosTable.taskId, pendingTasks.map((t) => t.id)),
          )
      : [];
  const photosByTask = new Map<number, (typeof taskPhotos)[number][]>();
  for (const p of taskPhotos) {
    photosByTask.set(p.taskId, [...(photosByTask.get(p.taskId) ?? []), p]);
  }

  const upcomingTasks = pendingTasks.map((t) => ({
    ...t,
    clientName: t.clientId ? clientById.get(t.clientId) ?? null : null,
    photos: photosByTask.get(t.id) ?? [],
  }));

  res.json(
    GetDashboardSummaryResponse.parse({
      pendingQuotesCount: pendingQuoteRows.length,
      pendingQuotesTotal,
      totalClients: clients.length,
      totalProducts: products.length,
      upcomingTasks,
      recentQuotes,
    }),
  );
});

export default router;
