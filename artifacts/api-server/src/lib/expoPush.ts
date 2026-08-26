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