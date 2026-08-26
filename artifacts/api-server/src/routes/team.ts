import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  teamsTable,
  usersTable,
  teamMembershipsTable,
} from "@workspace/db";
import {
  CreateTeamBody,
  CreateTeamResponse,
  GetTeamResponse,
  JoinTeamBody,
  JoinTeamResponse,
  SwitchTeamBody,
  UpdateTeamMemberRoleParams,
  UpdateTeamMemberRoleBody,
  UpdateTeamMemberRoleResponse,
  RemoveTeamMemberParams,
  RemoveTeamMemberResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function teamWithMembers(teamId: string, options?: { maskInvite?: boolean }) {
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));
  if (!team) return null;

  const members = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: teamMembershipsTable.role,
    })
    .from(teamMembershipsTable)
    .innerJoin(usersTable, eq(teamMembershipsTable.userId, usersTable.id))
    .where(eq(teamMembershipsTable.teamId, teamId));

  return {
    id: team.id,
    name: team.name,
    // Only owners can see the reusable invite code (members could otherwise
    // admit arbitrary accounts).
    inviteCode: options?.maskInvite ? "" : team.inviteCode,
    createdAt: team.createdAt,
    members,
  };
}

// GET /team — active team + members
router.get("/team", requireAuth, async (req, res) => {
  const user = req.localUser!;
  if (!user.teamId) {
    res.status(404).json({ error: "Usuário ainda não faz parte de uma equipe" });
    return;
  }
  const isOwner = await requireOwner(user.id, user.teamId);
  const team = await teamWithMembers(user.teamId, { maskInvite: !isOwner });
  if (!team) {
    res.status(404).json({ error: "Equipe não encontrada" });
    return;
  }
  res.json(GetTeamResponse.parse(team));
});

// GET /team/list — all teams this user belongs to
router.get("/team/list", requireAuth, async (req, res) => {
  const user = req.localUser!;
  const memberships = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      role: teamMembershipsTable.role,
    })
    .from(teamMembershipsTable)
    .innerJoin(teamsTable, eq(teamMembershipsTable.teamId, teamsTable.id))
    .where(eq(teamMembershipsTable.userId, user.id));
  res.json(memberships);
});

// POST /team/create — create a new team (no longer rejects existing members)
router.post("/team/create", requireAuth, async (req, res) => {
  const user = req.localUser!;
  const body = CreateTeamBody.parse(req.body);

  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [existing] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.inviteCode, inviteCode));
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  const [team] = await db
    .insert(teamsTable)
    .values({ name: body.name, inviteCode })
    .returning();

  // Add membership row
  await db
    .insert(teamMembershipsTable)
    .values({ userId: user.id, teamId: team.id, role: "owner" });

  // Switch active team to the newly created one
  await db
    .update(usersTable)
    .set({ teamId: team.id, role: "owner" })
    .where(eq(usersTable.id, user.id));

  const result = await teamWithMembers(team.id);
  res.status(201).json(CreateTeamResponse.parse(result));
});

// POST /team/join — join a team via invite code (no longer rejects existing members)
router.post("/team/join", requireAuth, async (req, res) => {
  const user = req.localUser!;
  const body = JoinTeamBody.parse(req.body);

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.inviteCode, body.inviteCode.toUpperCase()));

  if (!team) {
    res.status(400).json({ error: "Código de convite inválido" });
    return;
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(teamMembershipsTable)
    .where(
      and(
        eq(teamMembershipsTable.userId, user.id),
        eq(teamMembershipsTable.teamId, team.id),
      ),
    );

  if (existing) {
    // Already a member — just switch active team
    await db
      .update(usersTable)
      .set({ teamId: team.id, role: existing.role })
      .where(eq(usersTable.id, user.id));
    const result = await teamWithMembers(team.id, {
      maskInvite: existing.role !== "owner",
    });
    res.json(JoinTeamResponse.parse(result));
    return;
  }

  // New membership
  await db
    .insert(teamMembershipsTable)
    .values({ userId: user.id, teamId: team.id, role: "member" });

  await db
    .update(usersTable)
    .set({ teamId: team.id, role: "member" })
    .where(eq(usersTable.id, user.id));

  const result = await teamWithMembers(team.id, { maskInvite: true });
  res.json(JoinTeamResponse.parse(result));
});

// POST /team/switch — change active team (must be a member)
router.post("/team/switch", requireAuth, async (req, res) => {
  const user = req.localUser!;
  const { teamId } = SwitchTeamBody.parse(req.body);

  const [membership] = await db
    .select()
    .from(teamMembershipsTable)
    .where(
      and(
        eq(teamMembershipsTable.userId, user.id),
        eq(teamMembershipsTable.teamId, teamId),
      ),
    );

  if (!membership) {
    res.status(403).json({ error: "Você não é membro desta equipe" });
    return;
  }

  await db
    .update(usersTable)
    .set({ teamId, role: membership.role })
    .where(eq(usersTable.id, user.id));

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));

  const allMemberships = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      role: teamMembershipsTable.role,
    })
    .from(teamMembershipsTable)
    .innerJoin(teamsTable, eq(teamMembershipsTable.teamId, teamsTable.id))
    .where(eq(teamMembershipsTable.userId, user.id));

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    teamId,
    teamName: team?.name ?? null,
    role: membership.role,
    teams: allMemberships,
  });
});

/** Loads the requester's membership in their active team; sends 403 if not owner. */
async function requireOwner(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const [membership] = await db
    .select()
    .from(teamMembershipsTable)
    .where(
      and(
        eq(teamMembershipsTable.userId, userId),
        eq(teamMembershipsTable.teamId, teamId),
      ),
    );
  return membership?.role === "owner";
}

// PATCH /team/members/:userId — change a member's role (owner only)
router.patch("/team/members/:userId", requireAuth, async (req, res) => {
  const user = req.localUser!;
  if (!user.teamId) {
    res.status(403).json({ error: "Usuário ainda não faz parte de uma equipe" });
    return;
  }
  const { userId } = UpdateTeamMemberRoleParams.parse(req.params);
  const { role } = UpdateTeamMemberRoleBody.parse(req.body);
  const teamId = user.teamId;

  if (!(await requireOwner(user.id, teamId))) {
    res.status(403).json({ error: "Apenas o dono da equipe pode alterar papéis" });
    return;
  }

  const [target] = await db
    .select()
    .from(teamMembershipsTable)
    .where(
      and(
        eq(teamMembershipsTable.userId, userId),
        eq(teamMembershipsTable.teamId, teamId),
      ),
    );
  if (!target) {
    res.status(404).json({ error: "Membro não encontrado" });
    return;
  }

  // Prevent demoting the last owner
  if (target.role === "owner" && role !== "owner") {
    const owners = await db
      .select()
      .from(teamMembershipsTable)
      .where(
        and(
          eq(teamMembershipsTable.teamId, teamId),
          eq(teamMembershipsTable.role, "owner"),
        ),
      );
    if (owners.length <= 1) {
      res
        .status(403)
        .json({ error: "A equipe precisa ter pelo menos um dono" });
      return;
    }
  }

  await db
    .update(teamMembershipsTable)
    .set({ role })
    .where(eq(teamMembershipsTable.id, target.id));

  // Keep users.role in sync when this is the member's active team
  await db
    .update(usersTable)
    .set({ role })
    .where(and(eq(usersTable.id, userId), eq(usersTable.teamId, teamId)));

  const result = await teamWithMembers(teamId);
  res.json(UpdateTeamMemberRoleResponse.parse(result));
});

// DELETE /team/members/:userId — remove a member from the team (owner only)
router.delete("/team/members/:userId", requireAuth, async (req, res) => {
  const user = req.localUser!;
  if (!user.teamId) {
    res.status(403).json({ error: "Usuário ainda não faz parte de uma equipe" });
    return;
  }
  const { userId } = RemoveTeamMemberParams.parse(req.params);
  const teamId = user.teamId;

  if (!(await requireOwner(user.id, teamId))) {
    res
      .status(403)
      .json({ error: "Apenas o dono da equipe pode remover membros" });
    return;
  }

  const [target] = await db
    .select()
    .from(teamMembershipsTable)
    .where(
      and(
        eq(teamMembershipsTable.userId, userId),
        eq(teamMembershipsTable.teamId, teamId),
      ),
    );
  if (!target) {
    res.status(404).json({ error: "Membro não encontrado" });
    return;
  }

  if (target.role === "owner") {
    const owners = await db
      .select()
      .from(teamMembershipsTable)
      .where(
        and(
          eq(teamMembershipsTable.teamId, teamId),
          eq(teamMembershipsTable.role, "owner"),
        ),
      );
    if (owners.length <= 1) {
      res
        .status(403)
        .json({ error: "A equipe precisa ter pelo menos um dono" });
      return;
    }
  }

  await db
    .delete(teamMembershipsTable)
    .where(eq(teamMembershipsTable.id, target.id));

  // If this was the member's active team, switch them to another team (or none)
  const [removedUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (removedUser?.teamId === teamId) {
    const [nextMembership] = await db
      .select()
      .from(teamMembershipsTable)
      .where(eq(teamMembershipsTable.userId, userId));
    await db
      .update(usersTable)
      .set({
        teamId: nextMembership?.teamId ?? null,
        role: nextMembership?.role ?? null,
      })
      .where(eq(usersTable.id, userId));
  }

  const result = await teamWithMembers(teamId);
  res.json(RemoveTeamMemberResponse.parse(result));
});

export default router;
