import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, teamsTable } from "@workspace/db";
import { GetMeResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res) => {
  const user = req.localUser!;
  let teamName: string | null = null;
  if (user.teamId) {
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.id, user.teamId));
    teamName = team?.name ?? null;
  }

  const data = GetMeResponse.parse({
    id: user.id,
    email: user.email,
    name: user.name,
    teamId: user.teamId,
    teamName,
    role: user.role,
  });
  res.json(data);
});

export default router;
