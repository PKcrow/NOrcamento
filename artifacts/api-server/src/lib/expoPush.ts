import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pushTokensTable,
  teamMembershipsTable,
} from "@workspace/db";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const EXPO_PUSH_BATCH_SIZE = 100;
const PAYMENT_CLEANUP_MAX_ATTEMPTS = 3;
const PAYMENT_CLEANUP_RETRY_DELAYS_MS = [0, 250, 1_000] as const;

type QuoteResponseStatus = "approved" | "rejected";
type TaskReminderAction =
  | "created"
  | "rescheduled"
  | "payment_pending"
  | "payment_recorded";

function taskPaymentNotificationIdentifier(taskId: number): string {
  return `gestao-autonomos:payment:${taskId}`;
}

type ExpoPushTicket = {
  id?: string;
  status?: string;
  details?: { error?: string };
};

type ExpoPushReceipt = {
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

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function removeStalePushTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  await db
    .delete(pushTokensTable)
    .where(inArray(pushTokensTable.expoPushToken, tokens));
}

async function getUnconfirmedReceiptTokens(
  ticketEntries: Array<{ token: string; ticket: ExpoPushTicket }>,
) {
  const entriesWithIds = ticketEntries.filter(
    (entry): entry is { token: string; ticket: ExpoPushTicket & { id: string } } =>
      typeof entry.ticket.id === "string" && entry.ticket.id.length > 0,
  );
  if (entriesWithIds.length === 0) {
    return { retryTokens: [], staleTokens: [] };
  }

  try {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(process.env.EXPO_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        ids: entriesWithIds.map(({ ticket }) => ticket.id),
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return {
        retryTokens: entriesWithIds.map(({ token }) => token),
        staleTokens: [],
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: Record<string, ExpoPushReceipt> }
      | null;
    if (!payload?.data) {
      return {
        retryTokens: entriesWithIds.map(({ token }) => token),
        staleTokens: [],
      };
    }

    const retryTokens: string[] = [];
    const staleTokens: string[] = [];
    for (const { token, ticket } of entriesWithIds) {
      const receipt = payload.data[ticket.id];
      if (receipt?.status === "ok") continue;
      if (receipt?.details?.error === "DeviceNotRegistered") {
        staleTokens.push(token);
      } else {
        // ReceiptNotFound and any other missing/failed receipt are not
        // confirmations that the headless cleanup reached the device.
        retryTokens.push(token);
      }
    }
    return { retryTokens, staleTokens };
  } catch {
    return {
      retryTokens: entriesWithIds.map(({ token }) => token),
      staleTokens: [],
    };
  }
}

async function sendTaskReminderBatch({
  tokenBatch,
  taskId,
  taskTitle,
  dueAt,
  endAt,
  action,
}: {
  tokenBatch: string[];
  taskId: number;
  taskTitle: string;
  dueAt: Date;
  endAt: Date | null;
  action: TaskReminderAction;
}) {
  const isPaymentPending = action === "payment_pending";
  const isPaymentRecorded = action === "payment_recorded";
  const title = isPaymentPending
    ? "Pagamento pendente"
    : action === "created"
      ? "Nova O.S. agendada"
      : "O.S. reagendada";
  const body = isPaymentPending
    ? `${taskTitle} foi concluída e aguarda pagamento.`
    : (() => {
        const startStr = dueAt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const endStr = endAt
          ? ` – ${endAt.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "";
        return `${taskTitle} em ${startStr}${endStr}`;
      })();

  try {
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
        tokenBatch.map((to) => {
          if (isPaymentRecorded) {
            return {
              to,
              priority: "high",
              _contentAvailable: true,
              collapseId: taskPaymentNotificationIdentifier(taskId),
              data: {
                taskId: String(taskId),
                notificationType: "payment_recorded",
                notificationId: taskPaymentNotificationIdentifier(taskId),
              },
            };
          }

          return {
            to,
            sound: "default",
            title,
            body,
            channelId: "task-reminders",
            collapseId: `gestao-autonomos:task:${taskId}`,
            data: {
              taskId: String(taskId),
              notificationType: isPaymentPending
                ? "payment_pending"
                : "task_reminder",
              notificationId: isPaymentPending
                ? taskPaymentNotificationIdentifier(taskId)
                : undefined,
            },
          };
        }),
      ),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return {
        retryTokens: isPaymentRecorded ? tokenBatch : [],
        staleTokens: [],
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: ExpoPushTicket[] }
      | null;
    if (!payload?.data) {
      return {
        retryTokens: isPaymentRecorded ? tokenBatch : [],
        staleTokens: [],
      };
    }

    const retryTokens: string[] = [];
    const staleTokens: string[] = [];
    const receiptEntries: Array<{ token: string; ticket: ExpoPushTicket }> = [];
    for (const [index, token] of tokenBatch.entries()) {
      const ticket = payload.data[index];
      if (!ticket || ticket.status !== "ok") {
        if (ticket?.details?.error === "DeviceNotRegistered") {
          staleTokens.push(token);
        } else if (isPaymentRecorded) {
          retryTokens.push(token);
        }
        continue;
      }
      if (isPaymentRecorded) {
        if (typeof ticket.id === "string" && ticket.id.length > 0) {
          receiptEntries.push({ token, ticket });
        } else {
          // A successful ticket without its receipt id cannot be checked, so
          // do not treat it as confirmation of the headless cleanup.
          retryTokens.push(token);
        }
      }
    }

    if (isPaymentRecorded) {
      const receiptResult = await getUnconfirmedReceiptTokens(receiptEntries);
      retryTokens.push(...receiptResult.retryTokens);
      staleTokens.push(...receiptResult.staleTokens);
    }

    await removeStalePushTokens([...new Set(staleTokens)]);
    return {
      retryTokens: [...new Set(retryTokens)],
      staleTokens: [...new Set(staleTokens)],
    };
  } catch (err) {
    logger.warn(
      { err, taskId, action },
      "expo task push delivery request failed",
    );
    return {
      retryTokens: isPaymentRecorded ? tokenBatch : [],
      staleTokens: [],
    };
  }
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
            priority: "high",
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
 * Sends a best-effort push to all team members when a task is created,
 * rescheduled, completed without payment, or marked as paid. Delivery errors
 * are absorbed so notification outages never block task management.
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

    const isPaymentPending = action === "payment_pending";
    const isPaymentRecorded = action === "payment_recorded";
    let pendingTokens = tokens;
    const maxAttempts = isPaymentRecorded ? PAYMENT_CLEANUP_MAX_ATTEMPTS : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await wait(PAYMENT_CLEANUP_RETRY_DELAYS_MS[attempt]);
      }

      const retryTokens: string[] = [];
      for (const tokenBatch of chunks(pendingTokens, EXPO_PUSH_BATCH_SIZE)) {
        const result = await sendTaskReminderBatch({
          tokenBatch,
          taskId,
          taskTitle,
          dueAt,
          endAt,
          action,
        });
        retryTokens.push(...result.retryTokens);
      }

      pendingTokens = [...new Set(retryTokens)];
      if (pendingTokens.length === 0) return;

      logger.warn(
        {
          teamId,
          taskId,
          action,
          attempt: attempt + 1,
          retryLimit: maxAttempts,
          pendingTokenCount: pendingTokens.length,
        },
        "task push delivery was not confirmed; retrying",
      );
    }

    logger.warn(
      {
        teamId,
        taskId,
        action,
        retryLimit: maxAttempts,
        pendingTokenCount: pendingTokens.length,
      },
      "task push delivery was not confirmed after retry limit",
    );
  } catch (err) {
    logger.warn(
      { err, teamId, taskId },
      "failed to send task reminder push notification",
    );
  }
}