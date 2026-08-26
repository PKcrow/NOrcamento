import type { NextFunction, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import {
  db,
  teamMembershipsTable,
  usersTable,
  type User,
} from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      localUser?: User;
    }
  }
}

/**
 * Requires a signed-in Clerk user and JIT-provisions the local `users`
 * bridge row (keyed by Clerk user id) on first authenticated request.
 * Does NOT require a team — use `requireTeam` after this for team-scoped
 * routes.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (existing) {
      req.localUser = existing;
      next();
      return;
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email ||
      "Usuário";

    const [created] = await db
      .insert(usersTable)
      .values({ id: userId, email, name, teamId: null, role: null })
      .returning();

    req.localUser = created;
    next();
  } catch (err) {
    req.log.error({ err }, "failed to resolve authenticated user");
    res.status(500).json({ error: "Falha ao carregar usuário" });
  }
}

/**
 * Requires the authenticated user to belong to a team. Must run after
 * `requireAuth`. Use for all business-data routes (clients, products,
 * quotes, tasks, dashboard, notifications).
 */
export function requireTeam(req: Request, res: Response, next: NextFunction) {
  if (!req.localUser?.teamId) {
    res.status(403).json({ error: "Usuário ainda não faz parte de uma equipe" });
    return;
  }
  next();
}

/** Requires the signed-in user to be an owner of their active team. */
export async function requireTeamOwner(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.localUser?.id;
  const teamId = req.localUser?.teamId;
  if (!userId || !teamId) {
    res.status(403).json({ error: "Usuário ainda não faz parte de uma equipe" });
    return;
  }

  try {
    const [membership] = await db
      .select({ role: teamMembershipsTable.role })
      .from(teamMembershipsTable)
      .where(
        and(
          eq(teamMembershipsTable.userId, userId),
          eq(teamMembershipsTable.teamId, teamId),
        ),
      );
    if (membership?.role !== "owner") {
      res.status(403).json({
        error: "Apenas o dono da equipe pode revogar links de aprovação",
      });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "failed to validate team owner");
    res.status(500).json({ error: "Falha ao validar permissões da equipe" });
  }
}
