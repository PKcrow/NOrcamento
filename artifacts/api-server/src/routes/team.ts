import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, teamsTable, usersTable } from "@workspace/db";
import {
  CreateTeamBody,
  CreateTeamResponse,
  GetTeamResponse,
  JoinTeamBody,
  JoinTeamResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function teamWithMembers(teamId: string) {
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));
  if (!team) return null;

  const members = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.teamId, teamId));

  return {
    id: team.id,
    name: team.name,
    inviteCode: team.inviteCode,
    createdAt: team.createdAt,
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role ?? "member",
    })),
  };
}

router.get("/team", requireAuth, async (req, res) => {
  const user = req.localUser!;
  if (!user.teamId) {
    res.status(404).json({ error: "Usuário ainda não faz parte de uma equipe" });
    return;
  }
  const team = await teamWithMembers(user.teamId);
  if (!team) {
    res.status(404).json({ error: "Equipe não encontrada" });
    return;
  }
  res.json(GetTeamResponse.parse(team));
});

router.post("/team/create", requireAuth, async (req, res) => {
  const user = req.localUser!;
  if (user.teamId) {
    res.status(409).json({ error: "Usuário já faz parte de uma equipe" });
    return;
  }

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

  await db
    .update(usersTable)
    .set({ teamId: team.id, role: "owner" })
    .where(eq(usersTable.id, user.id));

  const result = await teamWithMembers(team.id);
  res.status(201).json(CreateTeamResponse.parse(result));
});

router.post("/team/join", requireAuth, async (req, res) => {
  const user = req.localUser!;
  if (user.teamId) {
    res.status(409).json({ error: "Usuário já faz parte de uma equipe" });
    return;
  }

  const body = JoinTeamBody.parse(req.body);

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.inviteCode, body.inviteCode.toUpperCase()));

  if (!team) {
    res.status(400).json({ error: "Código de convite inválido" });
    return;
  }

  await db
    .update(usersTable)
    .set({ teamId: team.id, role: "member" })
    .where(eq(usersTable.id, user.id));

  const result = await teamWithMembers(team.id);
  res.json(JoinTeamResponse.parse(result));
});

export default router;
