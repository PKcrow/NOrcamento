import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, teamsTable, teamMembershipsTable } from "@workspace/db";
import { GetCompanyResponse, UpdateCompanyBody, UpdateCompanyResponse } from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

function toCompany(team: typeof teamsTable.$inferSelect) {
  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    phone: team.phone,
    email: team.email,
    address: team.address,
    createdAt: team.createdAt,
  };
}

router.get("/company", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));
  if (!team) {
    res.status(404).json({ error: "Equipe não encontrada" });
    return;
  }
  res.json(GetCompanyResponse.parse(toCompany(team)));
});

router.patch("/company", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;
  const userId = req.localUser!.id;

  const [membership] = await db
    .select()
    .from(teamMembershipsTable)
    .where(
      and(
        eq(teamMembershipsTable.userId, userId),
        eq(teamMembershipsTable.teamId, teamId),
      ),
    );
  if (membership?.role !== "owner") {
    res
      .status(403)
      .json({ error: "Apenas o dono da equipe pode editar os dados da empresa" });
    return;
  }

  const body = UpdateCompanyBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));
  if (!existing) {
    res.status(404).json({ error: "Equipe não encontrada" });
    return;
  }

  const [updated] = await db
    .update(teamsTable)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
    })
    .where(eq(teamsTable.id, teamId))
    .returning();

  res.json(UpdateCompanyResponse.parse(toCompany(updated)));
});

export default router;
