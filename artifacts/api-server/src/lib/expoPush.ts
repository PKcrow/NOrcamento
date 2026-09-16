import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pushTokensTable,
  teamMembershipsTable,
} from "@workspace/db";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;

type QuoteResponseStatus = "approved" | "rejected";
type TaskReminderAction = "created" | "rescheduled";

type ExpoPushTicket = {
  status?: string;
  details?: { error?: string };
};

function isExpoPushToken(token: string): boolean {
  return /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/**
 * Sends a best-effort push after a public quote response. This function always
 * absorbs delivery errors so a notification outage can never undo or delay the
 * customer's approved/rejected response.
 */
export async function sendQuoteResponsePushNotification({
  teamId,
  quoteId,
  clientName,
  status,
}: {
  teamId: string;
  quoteId: number;
  clientName: string;
  status: QuoteResponseStatus;
}) {
  try {
    const rows = await db
      .select({ token: pushTokensTable.expoPushToken })
      .from(pushTokensTable)
      .innerJoin(
        teamMembershipsTable,
        and(
          eq(teamMembershipsTable.userId, pushTokensTable.userId),
          eq(teamMembershipsTable.teamId, pushTokensTable.teamId),
        ),
      )
      .where(eq(pushTokensTable.teamId, teamId));

    const tokens = [...new Set(rows.map((row) => row.token))].filter(
      isExpoPushToken,
    );
    if (tokens.length === 0) return;

    const approved = status === "approved";
    const title = approved ? "Orçamento aprovado" : "Orçamento recusado";
    const body = approved
      ? `${clientName} aprovou o orçamento #${quoteId}.`
      : `${clientName} recusou o orçamento #${quoteId}.`;

    for (const tokenBatch of chunks(tokens, EXPO_PUSH_BATCH_SIZE)) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(process.env.EXPO_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(
          tokenBatch.map((to) => ({
            to,
            sound: "default",
            title,
            body,
            channelId: "quote-responses",
            data: { quoteId: String(quoteId) },
          })),
        ),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, teamId, quoteId },
          "expo push delivery request failed",
        );
        continue;
      }

      const payload = (await response.json().catch(() => null)) as
        | { data?: ExpoPushTicket[] }
        | null;
      const staleTokens =
        payload?.data
          ?.flatMap((ticket, index) =>
            ticket.details?.error === "DeviceNotRegistered"
              ? [tokenBatch[index]]
              : [],
          )
          .filter((token): token is string => Boolean(token)) ?? [];

      if (staleTokens.length > 0) {
        await db
          .delete(pushTokensTable)
          .where(inArray(pushTokensTable.expoPushToken, staleTokens));
      }
    }
  } catch (err) {
    logger.warn(
      { err, teamId, quoteId },
      "failed to send quote response push notification",
    );
  }
}

/**
 * Sends a best-effort push to all team members when a task is created or
 * rescheduled. Delivery errors are absorbed so notification outages never
 * block task management.
 */
export async function sendTaskReminderPushNotification({
  teamId,
  taskId,
  taskTitle,
  dueAt,
  endAt,
  action,
}: {
  teamId: string;
  taskId: number;
  taskTitle: string;
  dueAt: Date;
  endAt: Date | null;
  action: TaskReminderAction;
}) {
  try {
    const rows = await db
      .select({ token: pushTokensTable.expoPushToken })
      .from(pushTokensTable)
      .innerJoin(
        teamMembershipsTable,
        and(
          eq(teamMembershipsTable.userId, pushTokensTable.userId),
          eq(teamMembershipsTable.teamId, pushTokensTable.teamId),
        ),
      )
      .where(eq(pushTokensTable.teamId, teamId));

    const tokens = [...new Set(rows.map((row) => row.token))].filter(
      isExpoPushToken,
    );
    if (tokens.length === 0) return;

    const title =
      action === "created" ? "Nova O.S. agendada" : "O.S. reagendada";
    const startStr = dueAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const endStr = endAt
      ? ` – ${endAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
      : "";
    const body = `${taskTitle} em ${startStr}${endStr}`;

    for (const tokenBatch of chunks(tokens, EXPO_PUSH_BATCH_SIZE)) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(process.env.EXPO_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(
          tokenBatch.map((to) => ({
            to,
            sound: "default",
            title,
            body,
            channelId: "task-reminders",
            data: { taskId: String(taskId) },
          })),
        ),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, teamId, taskId },
          "expo push delivery request failed for task reminder",
        );
        continue;
      }

      const payload = (await response.json().catch(() => null)) as
        | { data?: ExpoPushTicket[] }
        | null;
      const staleTokens =
        payload?.data
          ?.flatMap((ticket, index) =>
            ticket.details?.error === "DeviceNotRegistered"
              ? [tokenBatch[index]]
              : [],
          )
          .filter((token): token is string => Boolean(token)) ?? [];

      if (staleTokens.length > 0) {
        await db
          .delete(pushTokensTable)
          .where(inArray(pushTokensTable.expoPushToken, staleTokens));
      }
    }
  } catch (err) {
    logger.warn(
      { err, teamId, taskId },
      "failed to send task reminder push notification",
    );
  }
}