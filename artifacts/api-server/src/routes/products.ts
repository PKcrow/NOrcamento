import { Router, type IRouter } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  ListProductsQueryParams,
  ListProductsResponse,
  CreateProductBody,
  CreateProductResponse,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

function toNumber(product: typeof productsTable.$inferSelect) {
  return { ...product, price: Number(product.price) };
}

router.get("/products", requireAuth, requireTeam, async (req, res) => {
  const { search } = ListProductsQueryParams.parse(req.query);
  const teamId = req.localUser!.teamId!;

  const conditions = [eq(productsTable.teamId, teamId)];
  if (search) {
    conditions.push(ilike(productsTable.name, `%${search}%`));
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(...conditions))
    .orderBy(desc(productsTable.createdAt));

  res.json(ListProductsResponse.parse(products.map(toNumber)));
});

router.post("/products", requireAuth, requireTeam, async (req, res) => {
  const body = CreateProductBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  const [product] = await db
    .insert(productsTable)
    .values({
      teamId,
      name: body.name,
      description: body.description ?? null,
      price: String(body.price),
    })
    .returning();

  res.status(201).json(CreateProductResponse.parse(toNumber(product)));
});

router.patch("/products/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = UpdateProductParams.parse(req.params);
  const body = UpdateProductBody.parse(req.body);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.price !== undefined ? { price: String(body.price) } : {}),
    })
    .where(eq(productsTable.id, id))
    .returning();

  res.json(UpdateProductResponse.parse(toNumber(updated)));
});

router.delete("/products/:id", requireAuth, requireTeam, async (req, res) => {
  const { id } = DeleteProductParams.parse(req.params);
  const teamId = req.localUser!.teamId!;

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.teamId, teamId)));
  if (!existing) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).send();
});

export default router;
