import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";

type DatabaseExecutor = {
  select: typeof db.select;
  execute: typeof db.execute;
};

const OCCUPYING_STATUSES = ["scheduled", "in_progress"] as const;

function calendarDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function legacyTaskMightOverlap(
  legacyStart: Date,
  newStart: Date,
  newEnd: Date,
): boolean {
  const legacyDay = calendarDay(legacyStart);
  return (
    legacyDay >= calendarDay(newStart) &&
    legacyDay <= calendarDay(newEnd)
  );
}

export function getScheduleRangeError(
  start: Date,
  end: Date | null,
): string | null {
  if (!end) {
    return "Informe o horário de término para reservar este serviço.";
  }
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return "O horário de término deve ser posterior ao início.";
  }
  return null;
}

export async function findSchedulingConflict(
  teamId: string,
  start: Date,
  end: Date,
  excludeTaskId?: number,
  executor: DatabaseExecutor = db,
): Promise<string | null> {
  const conditions = [
    eq(tasksTable.teamId, teamId),
    inArray(tasksTable.status, OCCUPYING_STATUSES),
  ];
  if (excludeTaskId !== undefined) {
    conditions.push(ne(tasksTable.id, excludeTaskId));
  }

  const existingTasks = await executor
    .select()
    .from(tasksTable)
    .where(and(...conditions));

  for (const task of existingTasks) {
    if (!task.endAt) {
      if (legacyTaskMightOverlap(task.dueAt, start, end)) {
        return `O serviço "${task.title}" não possui horário de término. Defina-o antes de agendar outro atendimento neste período.`;
      }
      continue;
    }

    // Intervals use [start, end): an appointment ending at 12:00 and another
    // starting at 12:00 are consecutive, not conflicting.
    if (start < task.endAt && task.dueAt < end) {
      return `O horário se sobrepõe ao serviço "${task.title}". Escolha outro intervalo.`;
    }
  }

  return null;
}

export async function withTeamScheduleLock<T>(
  teamId: string,
  action: (executor: DatabaseExecutor & { insert: typeof db.insert; update: typeof db.update }) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${teamId}))`,
    );
    return action(tx);
  });
}