import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  productsTable,
  serviceTemplateItemsTable,
  serviceTemplatesTable,
  type ServiceTemplate,
  type ServiceTemplateItem,
} from "@workspace/db";
import {
  ListServiceTemplatesResponse,
  CreateServiceTemplateBody,
  CreateServiceTemplateResponse,
  GetServiceTemplateParams,
  GetServiceTemplateResponse,
  UpdateServiceTemplateParams,
  UpdateServiceTemplateBody,
  UpdateServiceTemplateResponse,
  DeleteServiceTemplateParams,
} from "@workspace/api-zod";
import { requireAuth, requireTeam } from "../middlewares/auth";

const router: IRouter = Router();

function templateWithItems(
  template: ServiceTemplate,
  items: ServiceTemplateItem[],
) {
  return {
    id: template.id,
    name: template.name,
    serviceScopeEnabled: template.serviceScopeEnabled,
    serviceDescription: template.serviceDescription,
    notes: template.notes,
    laborCost: Number(template.laborCost),
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

async function loadServiceTemplate(id: number, teamId: string) {
  const [template] = await db
    .select()
    .from(serviceTemplatesTable)
    .where(
      and(
        eq(serviceTemplatesTable.id, id),
        eq(serviceTemplatesTable.teamId, teamId),
      ),
    );
  if (!template) return null;

  const items = await db
    .select()
    .from(serviceTemplateItemsTable)
    .where(eq(serviceTemplateItemsTable.serviceTemplateId, id))
    .orderBy(serviceTemplateItemsTable.id);

  return templateWithItems(template, items);
}

async function verifyProductsBelongToTeam(
  items: Array<{ productId?: number | null }>,
  teamId: string,
) {
  const productIds = [
    ...new Set(
      items
        .map((item) => item.productId)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  if (productIds.length === 0) return true;

  const products = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.teamId, teamId),
        inArray(productsTable.id, productIds),
      ),
    );
  return products.length === productIds.length;
}

router.get("/service-templates", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;
  const templates = await db
    .select()
    .from(serviceTemplatesTable)
    .where(eq(serviceTemplatesTable.teamId, teamId))
    .orderBy(desc(serviceTemplatesTable.updatedAt));

  const results = await Promise.all(
    templates.map((template) => loadServiceTemplate(template.id, teamId)),
  );
  res.json(ListServiceTemplatesResponse.parse(results.filter(Boolean)));
});

router.post("/service-templates", requireAuth, requireTeam, async (req, res) => {
  const body = CreateServiceTemplateBody.parse(req.body);
  const teamId = req.localUser!.teamId!;
  if (!(await verifyProductsBelongToTeam(body.items, teamId))) {
    res.status(400).json({ error: "Produto inválido" });
    return;
  }

  const [template] = await db
    .insert(serviceTemplatesTable)
    .values({
      teamId,
      name: body.name,
      serviceScopeEnabled: body.serviceScopeEnabled ?? false,
      serviceDescription: body.serviceDescription ?? null,
      notes: body.notes ?? null,
      laborCost: String(body.laborCost ?? 0),
    })
    .returning();

  await db.insert(serviceTemplateItemsTable).values(
    body.items.map((item) => ({
      serviceTemplateId: template.id,
      productId: item.productId ?? null,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  );

  const result = await loadServiceTemplate(template.id, teamId);
  res.status(201).json(CreateServiceTemplateResponse.parse(result));
});

router.get(
  "/service-templates/:id",
  requireAuth,
  requireTeam,
  async (req, res) => {
    const { id } = GetServiceTemplateParams.parse(req.params);
    const result = await loadServiceTemplate(id, req.localUser!.teamId!);
    if (!result) {
      res.status(404).json({ error: "Modelo não encontrado" });
      return;
    }
    res.json(GetServiceTemplateResponse.parse(result));
  },
);

router.patch(
  "/service-templates/:id",
  requireAuth,
  requireTeam,
  async (req, res) => {
    const { id } = UpdateServiceTemplateParams.parse(req.params);
    const body = UpdateServiceTemplateBody.parse(req.body);
    const teamId = req.localUser!.teamId!;
    const existing = await loadServiceTemplate(id, teamId);
    if (!existing) {
      res.status(404).json({ error: "Modelo não encontrado" });
      return;
    }
    if (
      body.items !== undefined &&
      !(await verifyProductsBelongToTeam(body.items, teamId))
    ) {
      res.status(400).json({ error: "Produto inválido" });
      return;
    }

    await db
      .update(serviceTemplatesTable)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.serviceScopeEnabled !== undefined
          ? { serviceScopeEnabled: body.serviceScopeEnabled }
          : {}),
        ...(body.serviceDescription !== undefined
          ? { serviceDescription: body.serviceDescription }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.laborCost !== undefined
          ? { laborCost: String(body.laborCost) }
          : {}),
      })
      .where(eq(serviceTemplatesTable.id, id));

    if (body.items !== undefined) {
      await db
        .delete(serviceTemplateItemsTable)
        .where(eq(serviceTemplateItemsTable.serviceTemplateId, id));
      await db.insert(serviceTemplateItemsTable).values(
        body.items.map((item) => ({
          serviceTemplateId: id,
          productId: item.productId ?? null,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        })),
      );
    }

    const result = await loadServiceTemplate(id, teamId);
    res.json(UpdateServiceTemplateResponse.parse(result));
  },
);

router.delete(
  "/service-templates/:id",
  requireAuth,
  requireTeam,
  async (req, res) => {
    const { id } = DeleteServiceTemplateParams.parse(req.params);
    const teamId = req.localUser!.teamId!;
    const [existing] = await db
      .select({ id: serviceTemplatesTable.id })
      .from(serviceTemplatesTable)
      .where(
        and(
          eq(serviceTemplatesTable.id, id),
          eq(serviceTemplatesTable.teamId, teamId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Modelo não encontrado" });
      return;
    }

    await db.delete(serviceTemplatesTable).where(eq(serviceTemplatesTable.id, id));
    res.status(204).send();
  },
);

export default router;