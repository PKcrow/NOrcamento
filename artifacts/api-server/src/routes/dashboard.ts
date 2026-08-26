import { Router, type IRouter } from "express";
import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
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

const PRIORITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

router.get("/dashboard/summary", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;

  // Month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [clients, products, allQuotes, upcomingTaskRows, priorityTaskRows, linkedTaskRows, monthTasks] =
    await Promise.all([
      db.select().from(clientsTable).where(eq(clientsTable.teamId, teamId)),
      db.select().from(productsTable).where(eq(productsTable.teamId, teamId)),
      db.select().from(quotesTable).where(eq(quotesTable.teamId, teamId)),
      // Upcoming: scheduled or in_progress, sorted by date, max 5
      db
        .select()
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.teamId, teamId),
            inArray(tasksTable.status, ["scheduled", "in_progress"]),
          ),
        )
        .orderBy(asc(tasksTable.dueAt))
        .limit(5),
      db
        .select()
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.teamId, teamId),
            inArray(tasksTable.status, ["scheduled", "in_progress", "completed"]),
          ),
        )
        .orderBy(asc(tasksTable.dueAt)),
      db
        .select({ id: tasksTable.id, quoteId: tasksTable.quoteId })
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.teamId, teamId),
            isNotNull(tasksTable.quoteId),
          ),
        ),
      // All tasks this month to calculate KPIs
      db
        .select()
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.teamId, teamId),
            gte(tasksTable.dueAt, monthStart),
            lte(tasksTable.dueAt, monthEnd),
          ),
        ),
    ]);

  const clientById = new Map(clients.map((c) => [c.id, c.name]));
  const convertedTaskByQuote = new Map(
    linkedTaskRows.flatMap((task) =>
      task.quoteId === null ? [] : [[task.quoteId, task.id] as const],
    ),
  );

  // Financial KPIs
  const paidThisMonth = monthTasks.filter((t) => t.status === "paid");
  const completedThisMonth = monthTasks.filter(
    (t) => t.status === "completed" || t.status === "paid",
  );
  const monthlyRevenue = paidThisMonth.reduce(
    (sum, t) => sum + (t.paidAmount ? Number(t.paidAmount) : 0),
    0,
  );

  // Conversion rate: approved quotes / total non-draft quotes
  const approvedQuotes = allQuotes.filter((q) => q.status === "approved").length;
  const totalNonDraft = allQuotes.filter((q) => q.status !== "draft").length;
  const conversionRate =
    totalNonDraft > 0 ? Math.round((approvedQuotes / totalNonDraft) * 100) : 0;

  // Pending quotes
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
    ({
      ...quoteWithTotal(
        q,
        clientById.get(q.clientId) ?? "Cliente removido",
        itemsByQuote.get(q.id) ?? [],
      ),
      convertedTaskId: convertedTaskByQuote.get(q.id) ?? null,
    });

  const pendingQuotesTotal = pendingQuoteRows.reduce(
    (sum, q) => sum + withTotal(q).total,
    0,
  );

  const recentQuotes = recentQuoteRows.map(withTotal);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  const expiringThreshold = new Date(now.getTime() + PRIORITY_WINDOW_MS);
  const expiringQuotes = allQuotes.filter(
    (quote) =>
      quote.status === "sent" &&
      quote.publicToken &&
      quote.publicLinkExpiresAt &&
      quote.publicLinkExpiresAt.getTime() > now.getTime() &&
      quote.publicLinkExpiresAt.getTime() <= expiringThreshold.getTime(),
  );
  const expiringQuoteIds = new Set(expiringQuotes.map((quote) => quote.id));
  const priorities = [
    ...priorityTaskRows
      .filter(
        (task) =>
          task.dueAt.getTime() < now.getTime() &&
          (task.status === "scheduled" || task.status === "in_progress"),
      )
      .map((task) => ({
        type: "overdue_task" as const,
        priority: 100,
        title: task.title,
        reason: `Serviço atrasado desde ${task.dueAt.toLocaleDateString("pt-BR")}.`,
        target: "task" as const,
        targetId: task.id,
        sortAt: task.dueAt.getTime(),
      })),
    ...expiringQuotes
      .map((quote) => ({
        type: "expiring_link" as const,
        priority: 90,
        title: `Link de ${clientById.get(quote.clientId) ?? "Cliente"}`,
        reason: `Expira em ${quote.publicLinkExpiresAt!.toLocaleDateString("pt-BR")}.`,
        target: "quote" as const,
        targetId: quote.id,
        sortAt: quote.publicLinkExpiresAt!.getTime(),
      })),
    ...priorityTaskRows
      .filter(
        (task) =>
          task.dueAt >= todayStart &&
          task.dueAt <= todayEnd &&
          task.dueAt >= now &&
          (task.status === "scheduled" || task.status === "in_progress"),
      )
      .map((task) => ({
        type: "today_task" as const,
        priority: 80,
        title: task.title,
        reason: `Serviço de hoje às ${task.dueAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}.`,
        target: "task" as const,
        targetId: task.id,
        sortAt: task.dueAt.getTime(),
      })),
    ...priorityTaskRows
      .filter((task) => task.status === "completed")
      .map((task) => ({
        type: "pending_payment" as const,
        priority: 70,
        title: task.title,
        reason: "Serviço concluído aguardando pagamento.",
        target: "task" as const,
        targetId: task.id,
        sortAt: task.dueAt.getTime(),
      })),
    ...allQuotes
      .filter(
        (quote) => quote.status === "sent" && !expiringQuoteIds.has(quote.id),
      )
      .map((quote) => ({
        type: "quote_response" as const,
        priority: 60,
        title: `Orçamento de ${clientById.get(quote.clientId) ?? "Cliente"}`,
        reason: "Aguardando a resposta do cliente.",
        target: "quote" as const,
        targetId: quote.id,
        sortAt: quote.sentAt?.getTime() ?? quote.createdAt.getTime(),
      })),
  ]
    .sort((a, b) => b.priority - a.priority || a.sortAt - b.sortAt)
    .map(({ sortAt: _sortAt, ...priority }) => priority);

  const taskPhotos =
    upcomingTaskRows.length > 0
      ? await db
          .select()
          .from(taskPhotosTable)
          .where(
            inArray(
              taskPhotosTable.taskId,
              upcomingTaskRows.map((t) => t.id),
            ),
          )
      : [];
  const photosByTask = new Map<number, (typeof taskPhotos)[number][]>();
  for (const p of taskPhotos) {
    photosByTask.set(p.taskId, [...(photosByTask.get(p.taskId) ?? []), p]);
  }

  const upcomingTasks = upcomingTaskRows.map((t) => ({
    ...t,
    paidAmount: t.paidAmount ? Number(t.paidAmount) : null,
    clientName: t.clientId ? (clientById.get(t.clientId) ?? null) : null,
    photos: photosByTask.get(t.id) ?? [],
  }));

  res.json(
    GetDashboardSummaryResponse.parse({
      pendingQuotesCount: pendingQuoteRows.length,
      pendingQuotesTotal,
      totalClients: clients.length,
      totalProducts: products.length,
      monthlyRevenue,
      conversionRate,
      completedTasksCount: completedThisMonth.length,
      paidTasksCount: paidThisMonth.length,
      upcomingTasks,
      recentQuotes,
       priorities,
    }),
  );
});

export default router;
