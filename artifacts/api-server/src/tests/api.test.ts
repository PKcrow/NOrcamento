import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  teamsTable,
  teamMembershipsTable,
  clientsTable,
  quotesTable,
  pushTokensTable,
  serviceTemplatesTable,
  tasksTable,
} from "@workspace/db";
import { authState } from "./helpers";
import app from "../app";

const OWNER_ID = "test_owner_user";
const MEMBER_ID = "test_member_user";
const OUTSIDER_ID = "test_outsider_user";
const TEST_USER_IDS = [OWNER_ID, MEMBER_ID, OUTSIDER_ID];

let teamAId: string;
let teamBId: string;
let clientAId: number;

function as(userId: string | null) {
  authState.currentUserId = userId;
}

async function cleanup() {
  const teams = await db
    .select()
    .from(teamsTable)
    .where(inArray(teamsTable.name, ["Equipe Teste A", "Equipe Teste B"]));
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length > 0) {
    await db
      .delete(pushTokensTable)
      .where(inArray(pushTokensTable.teamId, teamIds));
    await db.delete(tasksTable).where(inArray(tasksTable.teamId, teamIds));
    const quotes = await db
      .select()
      .from(quotesTable)
      .where(inArray(quotesTable.teamId, teamIds));
    if (quotes.length > 0) {
      await db.delete(quotesTable).where(inArray(quotesTable.teamId, teamIds));
    }
    await db
      .delete(serviceTemplatesTable)
      .where(inArray(serviceTemplatesTable.teamId, teamIds));
    await db.delete(clientsTable).where(inArray(clientsTable.teamId, teamIds));
    await db
      .delete(teamMembershipsTable)
      .where(inArray(teamMembershipsTable.teamId, teamIds));
  }
  await db
    .delete(teamMembershipsTable)
    .where(inArray(teamMembershipsTable.userId, TEST_USER_IDS));
  await db
    .delete(pushTokensTable)
    .where(inArray(pushTokensTable.userId, TEST_USER_IDS));
  await db.delete(usersTable).where(inArray(usersTable.id, TEST_USER_IDS));
  if (teamIds.length > 0) {
    await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
  }
}

beforeAll(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("auth", () => {
  it("rejects unauthenticated requests", async () => {
    as(null);
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  it("provisions a user on first request", async () => {
    as(OWNER_ID);
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(OWNER_ID);
    expect(res.body.teamId).toBeNull();
  });

  it("blocks team-scoped routes before joining a team", async () => {
    as(OWNER_ID);
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(403);
  });
});

describe("teams", () => {
  it("creates a team and becomes owner", async () => {
    as(OWNER_ID);
    const res = await request(app)
      .post("/api/team/create")
      .send({ name: "Equipe Teste A" });
    expect(res.status).toBe(201);
    teamAId = res.body.id;
    expect(res.body.members[0].role).toBe("owner");
  });

  it("lets a second user join via invite code", async () => {
    as(OWNER_ID);
    const team = await request(app).get("/api/team");
    const inviteCode = team.body.inviteCode;

    as(MEMBER_ID);
    const res = await request(app)
      .post("/api/team/join")
      .send({ inviteCode });
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
  });

  it("outsider creates their own team (isolation baseline)", async () => {
    as(OUTSIDER_ID);
    const res = await request(app)
      .post("/api/team/create")
      .send({ name: "Equipe Teste B" });
    expect(res.status).toBe(201);
    teamBId = res.body.id;
  });

  it("rejects switching to a team the user is not in", async () => {
    as(OUTSIDER_ID);
    const res = await request(app)
      .post("/api/team/switch")
      .send({ teamId: teamAId });
    expect(res.status).toBe(403);
  });
});

describe("team isolation", () => {
  it("does not leak clients across teams", async () => {
    as(OWNER_ID);
    const created = await request(app)
      .post("/api/clients")
      .send({ name: "Cliente Teste Isolamento" });
    expect(created.status).toBe(201);
    clientAId = created.body.id;

    as(OUTSIDER_ID);
    const list = await request(app).get("/api/clients");
    expect(list.status).toBe(200);
    expect(
      list.body.find((c: { id: number }) => c.id === clientAId),
    ).toBeUndefined();
  });
});

describe("service templates", () => {
  let templateId: number;

  it("creates and lists a reusable template for the active team", async () => {
    as(OWNER_ID);
    const created = await request(app).post("/api/service-templates").send({
      name: "Instalação residencial",
      serviceScopeEnabled: true,
      serviceDescription: "Instalação e testes finais inclusos.",
      notes: "Garantia de 90 dias.",
      laborCost: 150,
      items: [
        { description: "Kit de instalação", quantity: 2, unitPrice: 80 },
        { description: "Deslocamento", quantity: 1, unitPrice: 30 },
      ],
    });

    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Instalação residencial");
    expect(created.body.items).toHaveLength(2);
    expect(created.body.laborCost).toBe(150);
    templateId = created.body.id;

    const list = await request(app).get("/api/service-templates");
    expect(list.status).toBe(200);
    expect(list.body.some((template: { id: number }) => template.id === templateId)).toBe(true);
  });

  it("keeps templates isolated from another team", async () => {
    as(OUTSIDER_ID);
    const list = await request(app).get("/api/service-templates");
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);

    const get = await request(app).get(`/api/service-templates/${templateId}`);
    expect(get.status).toBe(404);
    const update = await request(app)
      .patch(`/api/service-templates/${templateId}`)
      .send({ name: "Tentativa externa" });
    expect(update.status).toBe(404);
  });

  it("does not rewrite a quote copied from a changed or deleted template", async () => {
    as(OWNER_ID);
    const template = await request(app).get(`/api/service-templates/${templateId}`);
    expect(template.status).toBe(200);

    const copiedQuote = await request(app).post("/api/quotes").send({
      clientId: clientAId,
      serviceScopeEnabled: template.body.serviceScopeEnabled,
      serviceDescription: template.body.serviceDescription,
      notes: template.body.notes,
      laborCost: template.body.laborCost,
      items: template.body.items.map((item: {
        productId: number | null;
        description: string;
        quantity: number;
        unitPrice: number;
      }) => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
    expect(copiedQuote.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/service-templates/${templateId}`)
      .send({
        name: "Instalação revisada",
        laborCost: 999,
        items: [{ description: "Novo item", quantity: 1, unitPrice: 999 }],
      });
    expect(updated.status).toBe(200);
    expect(updated.body.items[0].description).toBe("Novo item");

    const removed = await request(app).delete(`/api/service-templates/${templateId}`);
    expect(removed.status).toBe(204);

    const quoteAfterTemplateChanges = await request(app).get(
      `/api/quotes/${copiedQuote.body.id}`,
    );
    expect(quoteAfterTemplateChanges.status).toBe(200);
    expect(quoteAfterTemplateChanges.body.laborCost).toBe(150);
    expect(quoteAfterTemplateChanges.body.items).toHaveLength(2);
    expect(quoteAfterTemplateChanges.body.items[0].description).toBe(
      "Kit de instalação",
    );
  });
});

describe("tasks: status flow and payments", () => {
  let taskId: number;

  it("creates a task as scheduled", async () => {
    as(OWNER_ID);
    const res = await request(app).post("/api/tasks").send({
      title: "OS Teste",
      dueAt: new Date("2030-01-10T12:00:00Z").toISOString(),
      endAt: new Date("2030-01-10T14:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("scheduled");
    taskId = res.body.id;
  });

  it("advances through the status flow", async () => {
    as(OWNER_ID);
    for (const status of ["in_progress", "completed"]) {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it("auto-sets paidAt when marked paid and stores paidAmount", async () => {
    as(OWNER_ID);
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({ status: "paid", paidAmount: 350.5 });
    expect(res.status).toBe(200);
    expect(res.body.paidAt).toBeTruthy();
    expect(res.body.paidAmount).toBe(350.5);
  });

  it("clears payment info when un-paying", async () => {
    as(OWNER_ID);
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(res.body.paidAt).toBeNull();
    expect(res.body.paidAmount).toBeNull();

    // Re-pay for later report tests
    const repaid = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({
        status: "paid",
        paidAmount: 350.5,
        paidAt: new Date("2030-01-15T10:00:00Z").toISOString(),
      });
    expect(repaid.status).toBe(200);
  });

  it("does not show the task to another team", async () => {
    as(OUTSIDER_ID);
    const res = await request(app).get(`/api/tasks/${taskId}`).send();
    expect([403, 404]).toContain(res.status);
  });
});

describe("dashboard priorities", () => {
  it("returns ordered, team-scoped actions for today's work", async () => {
    as(OWNER_ID);
    const now = new Date();
    const overdueDueAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const todayDueAt = new Date(now);
    todayDueAt.setHours(23, 0, 0, 0);
    const completedDueAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const overdue = await request(app).post("/api/tasks").send({
      title: "OS atrasada para prioridade",
      dueAt: overdueDueAt.toISOString(),
      endAt: new Date(overdueDueAt.getTime() + 60 * 60 * 1000).toISOString(),
      clientId: clientAId,
    });
    expect(overdue.status).toBe(201);

    const today = await request(app).post("/api/tasks").send({
      title: "OS de hoje para prioridade",
      dueAt: todayDueAt.toISOString(),
      endAt: new Date(todayDueAt.getTime() + 60 * 60 * 1000).toISOString(),
      clientId: clientAId,
    });
    expect(today.status).toBe(201);

    const payment = await request(app).post("/api/tasks").send({
      title: "OS aguardando pagamento",
      dueAt: completedDueAt.toISOString(),
      endAt: new Date(completedDueAt.getTime() + 60 * 60 * 1000).toISOString(),
      clientId: clientAId,
    });
    expect(payment.status).toBe(201);
    for (const status of ["in_progress", "completed"]) {
      const updated = await request(app)
        .patch(`/api/tasks/${payment.body.id}`)
        .send({ status });
      expect(updated.status).toBe(200);
    }

    const expiringQuote = await request(app).post("/api/quotes").send({
      clientId: clientAId,
      items: [{ description: "Link próximo de vencer", quantity: 1, unitPrice: 80 }],
    });
    const sharedExpiring = await request(app)
      .post(`/api/quotes/${expiringQuote.body.id}/share`);
    expect(sharedExpiring.status).toBe(200);
    await db
      .update(quotesTable)
      .set({ publicLinkExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) })
      .where(eq(quotesTable.id, expiringQuote.body.id));

    const pendingQuote = await request(app).post("/api/quotes").send({
      clientId: clientAId,
      items: [{ description: "Resposta aguardada", quantity: 1, unitPrice: 90 }],
    });
    const sharedPending = await request(app)
      .post(`/api/quotes/${pendingQuote.body.id}/share`);
    expect(sharedPending.status).toBe(200);

    const res = await request(app).get("/api/dashboard/summary");
    expect(res.status).toBe(200);
    const types = res.body.priorities.map((priority: { type: string }) => priority.type);
    expect(types).toEqual(expect.arrayContaining([
      "overdue_task",
      "expiring_link",
      "today_task",
      "pending_payment",
      "quote_response",
    ]));
    expect(types.indexOf("overdue_task")).toBeLessThan(types.indexOf("expiring_link"));
    expect(types.indexOf("expiring_link")).toBeLessThan(types.indexOf("today_task"));
    expect(types.indexOf("today_task")).toBeLessThan(types.indexOf("pending_payment"));
    expect(types.indexOf("pending_payment")).toBeLessThan(types.indexOf("quote_response"));
    expect(
      res.body.priorities.every((priority: { target: string; targetId: number }) =>
        (priority.target === "quote" || priority.target === "task") &&
        Number.isInteger(priority.targetId),
      ),
    ).toBe(true);
  });

  it("shows no priorities for an active team without pending work", async () => {
    as(OUTSIDER_ID);
    const res = await request(app).get("/api/dashboard/summary");
    expect(res.status).toBe(200);
    expect(res.body.priorities).toEqual([]);
  });
});

describe("quotes: search and public approval", () => {
  let quoteId: number;
  let publicToken: string;

  it("creates a quote", async () => {
    as(OWNER_ID);
    const res = await request(app)
      .post("/api/quotes")
      .send({
        clientId: clientAId,
        items: [{ description: "Serviço X", quantity: 2, unitPrice: 100 }],
        laborCost: 50,
      });
    expect(res.status).toBe(201);
    quoteId = res.body.id;
    expect(res.body.total).toBe(250);
  });

  it("finds quotes by client name via server-side search", async () => {
    as(OWNER_ID);
    const res = await request(app).get(
      "/api/quotes?search=Isolamento",
    );
    expect(res.status).toBe(200);
    expect(res.body.some((q: { id: number }) => q.id === quoteId)).toBe(true);

    const miss = await request(app).get("/api/quotes?search=zzznaoexiste");
    expect(miss.body).toHaveLength(0);
  });

  it("share generates a public token and moves draft to sent", async () => {
    as(OWNER_ID);
    const res = await request(app).post(`/api/quotes/${quoteId}/share`);
    expect(res.status).toBe(200);
    expect(res.body.publicToken).toBeTruthy();
    expect(res.body.status).toBe("sent");
    expect(res.body.publicLinkExpiresAt).toBeTruthy();
    publicToken = res.body.publicToken;

    // Idempotent: same token on second call
    const again = await request(app).post(`/api/quotes/${quoteId}/share`);
    expect(again.body.publicToken).toBe(publicToken);
  });

  it("serves the public quote without authentication", async () => {
    as(null);
    const res = await request(app).get(`/api/public/quotes/${publicToken}`);
    expect(res.status).toBe(200);
    expect(res.body.quote.id).toBe(quoteId);
    expect(res.body.company).toBeTruthy();
  });

  it("returns 404 for an invalid token", async () => {
    as(null);
    const res = await request(app).get("/api/public/quotes/invalid-token");
    expect(res.status).toBe(404);
  });

  it("rejects expired and revoked links, then lets an owner generate a replacement", async () => {
    as(OWNER_ID);
    const created = await request(app)
      .post("/api/quotes")
      .send({
        clientId: clientAId,
        items: [{ description: "Link seguro", quantity: 1, unitPrice: 20 }],
      });
    const shared = await request(app).post(
      `/api/quotes/${created.body.id}/share`,
    );
    const expiringToken = shared.body.publicToken;

    await db
      .update(quotesTable)
      .set({ publicLinkExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(quotesTable.id, created.body.id));

    as(null);
    const expired = await request(app).get(
      `/api/public/quotes/${expiringToken}`,
    );
    expect(expired.status).toBe(404);
    const expiredResponse = await request(app)
      .post(`/api/public/quotes/${expiringToken}/respond`)
      .send({ action: "approved" });
    expect(expiredResponse.status).toBe(404);

    as(OWNER_ID);
    const replacement = await request(app).post(
      `/api/quotes/${created.body.id}/share`,
    );
    const replacementToken = replacement.body.publicToken;
    expect(replacementToken).not.toBe(expiringToken);

    as(MEMBER_ID);
    const forbidden = await request(app).post(
      `/api/quotes/${created.body.id}/revoke-link`,
    );
    expect(forbidden.status).toBe(403);

    as(OWNER_ID);
    const revoked = await request(app).post(
      `/api/quotes/${created.body.id}/revoke-link`,
    );
    expect(revoked.status).toBe(200);
    expect(revoked.body.publicLinkRevokedAt).toBeTruthy();

    as(null);
    const disabled = await request(app).post(
      `/api/public/quotes/${replacementToken}/respond`,
    ).send({ action: "approved" });
    expect(disabled.status).toBe(404);
  });

  it("lets the client approve with a note, once", async () => {
    as(null);
    const res = await request(app)
      .post(`/api/public/quotes/${publicToken}/respond`)
      .send({ action: "approved", note: "Pode começar!" });
    expect(res.status).toBe(200);
    expect(res.body.quote.status).toBe("approved");
    expect(res.body.quote.clientResponseNote).toBe("Pode começar!");
    expect(res.body.quote.respondedAt).toBeTruthy();

    const again = await request(app)
      .post(`/api/public/quotes/${publicToken}/respond`)
      .send({ action: "rejected" });
    expect(again.status).toBe(409);
  });
});

describe("public response requires sent status", () => {
  it("rejects responding to a quote that is no longer sent", async () => {
    as(OWNER_ID);
    const created = await request(app)
      .post("/api/quotes")
      .send({
        clientId: clientAId,
        items: [{ description: "Serviço Y", quantity: 1, unitPrice: 10 }],
      });
    const shared = await request(app).post(
      `/api/quotes/${created.body.id}/share`,
    );
    const token = shared.body.publicToken;

    // Move it back to draft internally; the public link must stop working
    await request(app)
      .patch(`/api/quotes/${created.body.id}`)
      .send({ status: "draft" });

    as(null);
    const res = await request(app)
      .post(`/api/public/quotes/${token}/respond`)
      .send({ action: "approved" });
    expect(res.status).toBe(409);
  });
});

describe("approved quote scheduling", () => {
  let convertedQuoteId: number;
  let convertedTaskId: number;

  it("creates one linked task with the approved quote details", async () => {
    as(OWNER_ID);
    const quote = await request(app)
      .post("/api/quotes")
      .send({
        clientId: clientAId,
        status: "approved",
        serviceScopeEnabled: true,
        serviceDescription: "Instalação com acabamento incluso.",
        notes: "Levar material de proteção.",
        items: [{ description: "Serviço X", quantity: 2, unitPrice: 100 }],
        laborCost: 50,
      });
    expect(quote.status).toBe(201);
    convertedQuoteId = quote.body.id;

    const res = await request(app)
      .post(`/api/quotes/${convertedQuoteId}/convert-to-task`)
      .send({
        dueAt: new Date("2031-03-10T09:00:00Z").toISOString(),
        endAt: new Date("2031-03-10T12:00:00Z").toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.quoteId).toBe(convertedQuoteId);
    expect(res.body.clientId).toBe(clientAId);
    expect(res.body.description).toContain("Serviço X");
    expect(res.body.description).toContain("Total aprovado");
    convertedTaskId = res.body.id;

    const detail = await request(app).get(`/api/quotes/${convertedQuoteId}`);
    expect(detail.body.convertedTaskId).toBe(convertedTaskId);
  });

  it("returns the same task on a repeated conversion attempt", async () => {
    as(OWNER_ID);
    const res = await request(app)
      .post(`/api/quotes/${convertedQuoteId}/convert-to-task`)
      .send({
        dueAt: new Date("2031-03-11T09:00:00Z").toISOString(),
        endAt: new Date("2031-03-11T12:00:00Z").toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(convertedTaskId);
    expect(res.body.quoteId).toBe(convertedQuoteId);
  });

  it("keeps one task when two conversion requests arrive together", async () => {
    as(OWNER_ID);
    const concurrentQuote = await request(app)
      .post("/api/quotes")
      .send({
        clientId: clientAId,
        status: "approved",
        items: [{ description: "Conversão simultânea", quantity: 1, unitPrice: 40 }],
      });
    const payload = {
      dueAt: new Date("2031-03-11T09:00:00Z").toISOString(),
      endAt: new Date("2031-03-11T12:00:00Z").toISOString(),
    };

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/quotes/${concurrentQuote.body.id}/convert-to-task`)
        .send(payload),
      request(app)
        .post(`/api/quotes/${concurrentQuote.body.id}/convert-to-task`)
        .send(payload),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.id).toBe(second.body.id);
    expect(first.body.quoteId).toBe(concurrentQuote.body.id);
  });

  it("rejects an unapproved quote and requests from another team", async () => {
    as(OWNER_ID);
    const draft = await request(app)
      .post("/api/quotes")
      .send({
        clientId: clientAId,
        items: [{ description: "Ainda não aprovado", quantity: 1, unitPrice: 10 }],
      });

    const unapproved = await request(app)
      .post(`/api/quotes/${draft.body.id}/convert-to-task`)
      .send({
        dueAt: new Date("2031-04-10T09:00:00Z").toISOString(),
        endAt: new Date("2031-04-10T12:00:00Z").toISOString(),
      });
    expect(unapproved.status).toBe(409);

    as(OUTSIDER_ID);
    const outsider = await request(app)
      .post(`/api/quotes/${convertedQuoteId}/convert-to-task`)
      .send({
        dueAt: new Date("2031-04-10T09:00:00Z").toISOString(),
        endAt: new Date("2031-04-10T12:00:00Z").toISOString(),
      });
    expect(outsider.status).toBe(404);
  });

  it("rejects a schedule that conflicts with another service", async () => {
    as(OWNER_ID);
    const approved = await request(app)
      .post("/api/quotes")
      .send({
        clientId: clientAId,
        status: "approved",
        items: [{ description: "Conflito", quantity: 1, unitPrice: 30 }],
      });
    const dueAt = new Date("2031-05-10T09:00:00Z").toISOString();
    const existing = await request(app).post("/api/tasks").send({
      title: "Serviço já agendado",
      dueAt,
      endAt: new Date("2031-05-10T12:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(existing.status).toBe(201);

    const conflict = await request(app)
      .post(`/api/quotes/${approved.body.id}/convert-to-task`)
      .send({ dueAt, endAt: new Date("2031-05-10T12:00:00Z").toISOString() });
    expect(conflict.status).toBe(409);
  });

  it("allows separated and consecutive services, while blocking overlapping active intervals", async () => {
    as(OWNER_ID);
    const first = await request(app).post("/api/tasks").send({
      title: "Atendimento da manhã",
      dueAt: new Date("2031-06-10T07:00:00Z").toISOString(),
      endAt: new Date("2031-06-10T12:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(first.status).toBe(201);

    const consecutive = await request(app).post("/api/tasks").send({
      title: "Atendimento do meio-dia",
      dueAt: new Date("2031-06-10T12:00:00Z").toISOString(),
      endAt: new Date("2031-06-10T13:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(consecutive.status).toBe(201);

    const separate = await request(app).post("/api/tasks").send({
      title: "Atendimento da tarde",
      dueAt: new Date("2031-06-10T13:00:00Z").toISOString(),
      endAt: new Date("2031-06-10T17:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(separate.status).toBe(201);

    const partialOverlap = await request(app).post("/api/tasks").send({
      title: "Sobreposição parcial",
      dueAt: new Date("2031-06-10T11:00:00Z").toISOString(),
      endAt: new Date("2031-06-10T14:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(partialOverlap.status).toBe(409);

    const inProgress = await request(app)
      .patch(`/api/tasks/${first.body.id}`)
      .send({ status: "in_progress" });
    expect(inProgress.status).toBe(200);
    const containedOverlap = await request(app).post("/api/tasks").send({
      title: "Dentro do atendimento",
      dueAt: new Date("2031-06-10T08:00:00Z").toISOString(),
      endAt: new Date("2031-06-10T09:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(containedOverlap.status).toBe(409);
  });

  it("conservatively blocks a multi-day interval around a legacy task without an end time", async () => {
    as(OWNER_ID);
    await db.insert(tasksTable).values({
      teamId: teamAId,
      title: "Atendimento antigo sem término",
      dueAt: new Date("2032-11-01T09:00:00Z"),
      endAt: null,
      clientId: clientAId,
    });

    const crossingMonth = await request(app).post("/api/tasks").send({
      title: "Serviço que cruza o mês",
      dueAt: new Date("2032-10-31T07:00:00Z").toISOString(),
      endAt: new Date("2032-11-02T17:00:00Z").toISOString(),
      clientId: clientAId,
    });
    expect(crossingMonth.status).toBe(409);
    expect(crossingMonth.body.error).toContain("não possui horário de término");
  });
});

describe("monthly report", () => {
  it("aggregates revenue for the month of the paid task", async () => {
    as(OWNER_ID);
    const res = await request(app).get("/api/reports/monthly?year=2030&month=1");
    expect(res.status).toBe(200);
    expect(res.body.revenue).toBe(350.5);
    expect(res.body.paidTasksCount).toBe(1);
    expect(res.body.paidTasks[0].title).toBe("OS Teste");
  });

  it("returns zeros for an empty month", async () => {
    as(OWNER_ID);
    const res = await request(app).get("/api/reports/monthly?year=2029&month=6");
    expect(res.status).toBe(200);
    expect(res.body.revenue).toBe(0);
    expect(res.body.paidTasksCount).toBe(0);
  });
});

describe("team permissions", () => {
  it("hides the invite code from regular members", async () => {
    as(MEMBER_ID);
    const res = await request(app).get("/api/team");
    expect(res.status).toBe(200);
    expect(res.body.inviteCode).toBe("");

    as(OWNER_ID);
    const owner = await request(app).get("/api/team");
    expect(owner.body.inviteCode).not.toBe("");
  });

  it("blocks a regular member from editing company data", async () => {
    as(MEMBER_ID);
    const res = await request(app)
      .patch("/api/company")
      .send({ name: "Hackeada" });
    expect(res.status).toBe(403);
  });

  it("blocks a regular member from changing roles", async () => {
    as(MEMBER_ID);
    const res = await request(app)
      .patch(`/api/team/members/${OWNER_ID}`)
      .send({ role: "member" });
    expect(res.status).toBe(403);
  });

  it("blocks a regular member from removing members", async () => {
    as(MEMBER_ID);
    const res = await request(app).delete(`/api/team/members/${OWNER_ID}`);
    expect(res.status).toBe(403);
  });

  it("prevents demoting the last owner", async () => {
    as(OWNER_ID);
    const res = await request(app)
      .patch(`/api/team/members/${OWNER_ID}`)
      .send({ role: "member" });
    expect(res.status).toBe(403);
  });

  it("owner promotes a member, then the ex-owner can be demoted", async () => {
    as(OWNER_ID);
    const promote = await request(app)
      .patch(`/api/team/members/${MEMBER_ID}`)
      .send({ role: "owner" });
    expect(promote.status).toBe(200);
    const promoted = promote.body.members.find(
      (m: { id: string }) => m.id === MEMBER_ID,
    );
    expect(promoted.role).toBe("owner");

    const demote = await request(app)
      .patch(`/api/team/members/${OWNER_ID}`)
      .send({ role: "member" });
    expect(demote.status).toBe(200);

    // restore
    as(MEMBER_ID);
    const restore = await request(app)
      .patch(`/api/team/members/${OWNER_ID}`)
      .send({ role: "owner" });
    expect(restore.status).toBe(200);
  });

  it("owner removes a member and their active team is reassigned", async () => {
    as(OWNER_ID);
    const res = await request(app).delete(`/api/team/members/${MEMBER_ID}`);
    expect(res.status).toBe(200);
    expect(
      res.body.members.find((m: { id: string }) => m.id === MEMBER_ID),
    ).toBeUndefined();

    as(MEMBER_ID);
    const me = await request(app).get("/api/me");
    expect(me.body.teamId).not.toBe(teamAId);
  });

  it("404s when managing a non-member", async () => {
    as(OWNER_ID);
    const res = await request(app).delete(`/api/team/members/${OUTSIDER_ID}`);
    expect(res.status).toBe(404);
  });
});

describe("notifications", () => {
  it("includes overdue scheduled tasks", async () => {
    as(OWNER_ID);
    const created = await request(app).post("/api/tasks").send({
      title: "OS Atrasada",
      dueAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      endAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
    });
    expect(created.status).toBe(201);

    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(200);
    expect(
      res.body.overdueTasks.some(
        (t: { id: number }) => t.id === created.body.id,
      ),
    ).toBe(true);
  });

  it("includes recent quote approvals and rejections with a linkable quote id", async () => {
    as(OWNER_ID);
    const created = await request(app).post("/api/quotes").send({
      clientId: clientAId,
      items: [{ description: "Resposta avisada", quantity: 1, unitPrice: 80 }],
    });
    const shared = await request(app).post(
      `/api/quotes/${created.body.id}/share`,
    );

    as(null);
    const response = await request(app)
      .post(`/api/public/quotes/${shared.body.publicToken}/respond`)
      .send({ action: "rejected", note: "Vou adiar." });
    expect(response.status).toBe(200);

    as(OWNER_ID);
    const notifications = await request(app).get("/api/notifications");
    expect(notifications.status).toBe(200);
    expect(
      notifications.body.quoteResponses.some(
        (quote: { id: number; status: string; clientName: string }) =>
          quote.id === created.body.id &&
          quote.status === "rejected" &&
          quote.clientName === "Cliente Teste Isolamento",
      ),
    ).toBe(true);
  });

  it("sends a push for a public response and discards invalid device tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              status: "error",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      as(OWNER_ID);
      const token = "ExponentPushToken[test-device-token]";
      const registration = await request(app).post("/api/push-tokens").send({
        token,
        platform: "android",
      });
      expect(registration.status).toBe(204);

      const stored = await db
        .select()
        .from(pushTokensTable)
        .where(eq(pushTokensTable.expoPushToken, token));
      expect(stored).toHaveLength(1);
      expect(stored[0]?.teamId).toBe(teamAId);

      const created = await request(app).post("/api/quotes").send({
        clientId: clientAId,
        items: [{ description: "Push real", quantity: 1, unitPrice: 120 }],
      });
      const shared = await request(app).post(
        `/api/quotes/${created.body.id}/share`,
      );

      as(null);
      const response = await request(app)
        .post(`/api/public/quotes/${shared.body.publicToken}/respond`)
        .send({ action: "approved" });
      expect(response.status).toBe(200);

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const [, requestOptions] = fetchMock.mock.calls[0] ?? [];
      const messages = JSON.parse(String(requestOptions?.body));
      expect(messages[0]).toMatchObject({
        to: token,
        title: "Orçamento aprovado",
        data: { quoteId: String(created.body.id) },
      });

      await vi.waitFor(async () => {
        const remaining = await db
          .select()
          .from(pushTokensTable)
          .where(eq(pushTokensTable.expoPushToken, token));
        expect(remaining).toHaveLength(0);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
