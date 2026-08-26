import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, clientsTable, quotesTable, tasksTable } from "@workspace/db";
import {
  GetMonthlyReportQueryParams,
  GetMonthlyReportResponse,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/reports/monthly", requireAuth, requireTeam, async (req, res) => {
  const { year, month } = GetMonthlyReportQueryParams.parse(req.query);
  const teamId = req.localUser!.teamId!;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const paidTasksRows = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.teamId, teamId),
        eq(tasksTable.status, "paid"),
        gte(tasksTable.paidAt, start),
        lt(tasksTable.paidAt, end),
      ),
    );

  const completedTasks = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.teamId, teamId),
        eq(tasksTable.status, "completed"),
        gte(tasksTable.dueAt, start),
        lt(tasksTable.dueAt, end),
      ),
    );

  const quotesSent = await db
    .select({ id: quotesTable.id })
    .from(quotesTable)
    .where(
      and(
        eq(quotesTable.teamId, teamId),
        gte(quotesTable.sentAt, start),
        lt(quotesTable.sentAt, end),
      ),
    );

  const quotesApproved = await db
    .select({ id: quotesTable.id })
    .from(quotesTable)
    .where(
      and(
        eq(quotesTable.teamId, teamId),
        eq(quotesTable.status, "approved"),
        gte(quotesTable.respondedAt, start),
        lt(quotesTable.respondedAt, end),
      ),
    );

  const clients = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.teamId, teamId));
  const clientById = new Map(clients.map((c) => [c.id, c.name]));

  const paidTasks = paidTasksRows
    .sort((a, b) => (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0))
    .map((t) => ({
      id: t.id,
      title: t.title,
      clientName: t.clientId ? clientById.get(t.clientId) ?? null : null,
      paidAt: t.paidAt!,
      paidAmount: t.paidAmount !== null ? Number(t.paidAmount) : null,
    }));

  const revenue = paidTasks.reduce((sum, t) => sum + (t.paidAmount ?? 0), 0);

  res.json(
    GetMonthlyReportResponse.parse({
      year,
      month,
      revenue,
      paidTasksCount: paidTasks.length,
      completedTasksCount: completedTasks.length,
      quotesSentCount: quotesSent.length,
      quotesApprovedCount: quotesApproved.length,
      paidTasks,
    }),
  );
});

export default router;
