import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  companyDocumentsTable,
  taskPhotosTable,
  tasksTable,
  teamsTable,
} from "@workspace/db";

import { requireAuth, requireTeam } from "../middlewares/auth";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a signed URL for a direct upload to Supabase Storage.
 * The client sends metadata here, then uploads the file directly to Supabase.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  requireTeam,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const { uploadURL, objectPath } =
        await objectStorageService.getObjectEntityUploadURL(
          req.localUser!.teamId!,
          contentType,
        );

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from SUPABASE_STORAGE_PUBLIC_PREFIXES in `arquivos`.
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join("/") : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const signedUrl =
        await objectStorageService.getObjectEntitySignedReadURL(file, 3600);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, signedUrl);
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve private objects only after verifying the user's team association.
 */
router.get(
  "/storage/objects/*path",
  requireAuth,
  requireTeam,
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;
      const teamId = req.localUser!.teamId!;

      if (!(await belongsToTeam(teamId, objectPath))) {
        res
          .status(403)
          .json({ error: "Acesso negado: arquivo não pertence à sua equipe" });
        return;
      }

      const objectFile =
        await objectStorageService.getObjectEntityFile(objectPath);
      const signedUrl =
        await objectStorageService.getObjectEntitySignedReadURL(objectFile, 3600);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.redirect(302, signedUrl);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;

async function belongsToTeam(
  teamId: string,
  objectPath: string,
): Promise<boolean> {
  if (objectPath.startsWith(`/objects/${teamId}/`)) return true;

  const [document] = await db
    .select({ id: companyDocumentsTable.id })
    .from(companyDocumentsTable)
    .where(
      and(
        eq(companyDocumentsTable.teamId, teamId),
        eq(companyDocumentsTable.objectPath, objectPath),
      ),
    )
    .limit(1);
  if (document) return true;

  const [team] = await db
    .select({ logoUrl: teamsTable.logoUrl })
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  if (team?.logoUrl && storedObjectPath(team.logoUrl) === objectPath) return true;

  const photos = await db
    .select({ url: taskPhotosTable.url })
    .from(taskPhotosTable)
    .innerJoin(tasksTable, eq(taskPhotosTable.taskId, tasksTable.id))
    .where(eq(tasksTable.teamId, teamId));
  return photos.some((photo) => storedObjectPath(photo.url) === objectPath);
}

function storedObjectPath(value: string): string | null {
  let pathname = value;
  try {
    if (/^https?:\/\//i.test(value)) pathname = new URL(value).pathname;
  } catch {
    return null;
  }
  const direct = pathname.match(/\/objects\/(.+)$/);
  if (direct) return `/objects/${direct[1].split(/[?#]/, 1)[0]}`;
  const route = pathname.match(/\/api\/storage\/objects\/(.+)$/);
  return route ? `/objects/${route[1].split(/[?#]/, 1)[0]}` : null;
}
