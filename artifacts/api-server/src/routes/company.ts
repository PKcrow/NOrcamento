import { Router, type IRouter } from "express";
import { Readable } from "node:stream";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  companyDocumentsTable,
  teamsTable,
  teamMembershipsTable,
} from "@workspace/db";
import {
  CreateCompanyDocumentBody,
  CreateCompanyDocumentResponse,
  DeleteCompanyDocumentParams,
  GetCompanyResponse,
  ListCompanyDocumentsResponse,
  UpdateCompanyBody,
  UpdateCompanyResponse,
} from "@workspace/api-zod";
import { requireAuth, requireTeam, requireTeamOwner } from "../middlewares/auth";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import {
  downloadPrivateCompanyLogo,
  getPrivateCompanyLogoObjectPath,
} from "../lib/companyLogo";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

function toCompany(team: typeof teamsTable.$inferSelect) {
  return {
    id: team.id,
    name: team.name,
    logoUrl:
      team.logoUrl && getPrivateCompanyLogoObjectPath(team.logoUrl)
        ? "/api/company/logo"
        : team.logoUrl,
    phone: team.phone,
    email: team.email,
    address: team.address,
    legalName: team.legalName,
    taxId: team.taxId,
    website: team.website,
    pixKey: team.pixKey,
    bankDetails: team.bankDetails,
    paymentInstructions: team.paymentInstructions,
    additionalInfo: team.additionalInfo,
    marketingHeadline: team.marketingHeadline,
    marketingAbout: team.marketingAbout,
    marketingServices: team.marketingServices,
    marketingDifferentials: team.marketingDifferentials,
    showPhoneOnQuotes: team.showPhoneOnQuotes,
    showEmailOnQuotes: team.showEmailOnQuotes,
    showAddressOnQuotes: team.showAddressOnQuotes,
    showLegalNameOnQuotes: team.showLegalNameOnQuotes,
    showTaxIdOnQuotes: team.showTaxIdOnQuotes,
    showWebsiteOnQuotes: team.showWebsiteOnQuotes,
    showPixKeyOnQuotes: team.showPixKeyOnQuotes,
    showBankDetailsOnQuotes: team.showBankDetailsOnQuotes,
    showPaymentInstructionsOnQuotes: team.showPaymentInstructionsOnQuotes,
    showAdditionalInfoOnQuotes: team.showAdditionalInfoOnQuotes,
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

router.get("/company/logo", requireAuth, requireTeam, async (req, res) => {
  const teamId = req.localUser!.teamId!;
  const [team] = await db
    .select({ logoUrl: teamsTable.logoUrl })
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));
  if (!team?.logoUrl || !getPrivateCompanyLogoObjectPath(team.logoUrl)) {
    res.status(404).json({ error: "Logo não encontrada" });
    return;
  }

  try {
    const response = await downloadPrivateCompanyLogo(team.logoUrl);
    if (!response) {
      res.status(404).json({ error: "Logo não encontrada" });
      return;
    }
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "private, no-store");
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Logo não encontrada" });
      return;
    }
    req.log.error({ err: error }, "Error serving company logo");
    res.status(500).json({ error: "Não foi possível carregar a logo" });
  }
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
      ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
      ...(body.taxId !== undefined ? { taxId: body.taxId } : {}),
      ...(body.website !== undefined ? { website: body.website } : {}),
      ...(body.pixKey !== undefined ? { pixKey: body.pixKey } : {}),
      ...(body.bankDetails !== undefined ? { bankDetails: body.bankDetails } : {}),
      ...(body.paymentInstructions !== undefined ? { paymentInstructions: body.paymentInstructions } : {}),
      ...(body.additionalInfo !== undefined ? { additionalInfo: body.additionalInfo } : {}),
      ...(body.marketingHeadline !== undefined ? { marketingHeadline: body.marketingHeadline } : {}),
      ...(body.marketingAbout !== undefined ? { marketingAbout: body.marketingAbout } : {}),
      ...(body.marketingServices !== undefined ? { marketingServices: body.marketingServices } : {}),
      ...(body.marketingDifferentials !== undefined ? { marketingDifferentials: body.marketingDifferentials } : {}),
      ...(body.showPhoneOnQuotes !== undefined ? { showPhoneOnQuotes: body.showPhoneOnQuotes } : {}),
      ...(body.showEmailOnQuotes !== undefined ? { showEmailOnQuotes: body.showEmailOnQuotes } : {}),
      ...(body.showAddressOnQuotes !== undefined ? { showAddressOnQuotes: body.showAddressOnQuotes } : {}),
      ...(body.showLegalNameOnQuotes !== undefined ? { showLegalNameOnQuotes: body.showLegalNameOnQuotes } : {}),
      ...(body.showTaxIdOnQuotes !== undefined ? { showTaxIdOnQuotes: body.showTaxIdOnQuotes } : {}),
      ...(body.showWebsiteOnQuotes !== undefined ? { showWebsiteOnQuotes: body.showWebsiteOnQuotes } : {}),
      ...(body.showPixKeyOnQuotes !== undefined ? { showPixKeyOnQuotes: body.showPixKeyOnQuotes } : {}),
      ...(body.showBankDetailsOnQuotes !== undefined ? { showBankDetailsOnQuotes: body.showBankDetailsOnQuotes } : {}),
      ...(body.showPaymentInstructionsOnQuotes !== undefined ? { showPaymentInstructionsOnQuotes: body.showPaymentInstructionsOnQuotes } : {}),
      ...(body.showAdditionalInfoOnQuotes !== undefined ? { showAdditionalInfoOnQuotes: body.showAdditionalInfoOnQuotes } : {}),
    })
    .where(eq(teamsTable.id, teamId))
    .returning();

  res.json(UpdateCompanyResponse.parse(toCompany(updated)));
});

router.get("/company/documents", requireAuth, requireTeam, async (req, res) => {
  const documents = await db
    .select()
    .from(companyDocumentsTable)
    .where(eq(companyDocumentsTable.teamId, req.localUser!.teamId!))
    .orderBy(asc(companyDocumentsTable.createdAt));

  res.json(ListCompanyDocumentsResponse.parse(documents));
});

router.post(
  "/company/documents",
  requireAuth,
  requireTeamOwner,
  async (req, res) => {
    const body = CreateCompanyDocumentBody.parse(req.body);
    if (!body.objectPath.startsWith("/objects/")) {
      res.status(400).json({ error: "Caminho de arquivo inválido" });
      return;
    }

    const [document] = await db
      .insert(companyDocumentsTable)
      .values({
        teamId: req.localUser!.teamId!,
        name: body.name.trim(),
        documentType: body.documentType.trim(),
        fileName: body.fileName.trim(),
        objectPath: body.objectPath,
        contentType: body.contentType,
        size: body.size,
      })
      .returning();

    res.status(201).json(CreateCompanyDocumentResponse.parse(document));
  },
);

router.delete(
  "/company/documents/:id",
  requireAuth,
  requireTeamOwner,
  async (req, res) => {
    const { id } = DeleteCompanyDocumentParams.parse(req.params);
    const [document] = await db
      .select({ id: companyDocumentsTable.id, objectPath: companyDocumentsTable.objectPath })
      .from(companyDocumentsTable)
      .where(
        and(
          eq(companyDocumentsTable.id, id),
          eq(companyDocumentsTable.teamId, req.localUser!.teamId!),
        ),
      );
    if (!document) {
      res.status(404).json({ error: "Documento não encontrado" });
      return;
    }

    // Remove the file from object storage
    try {
      if (document.objectPath) {
        await objectStorage.deleteObjectEntity(document.objectPath);
      }
    } catch {
      // Log but don't fail the request if storage delete fails
    }

    await db.delete(companyDocumentsTable).where(eq(companyDocumentsTable.id, id));
    res.status(204).send();
  },
);

export default router;
