import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface StoredObject {
  key: string;
}

interface StorageResult<T> {
  data: T | null;
  error: unknown | null;
}

interface SupabaseStorageBucket {
  createSignedUploadUrl(
    path: string,
    options?: { upsert?: boolean },
  ): Promise<
    StorageResult<{
      signedUrl: string;
      token: string;
      path: string;
    }>
  >;
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<StorageResult<{ signedUrl: string }>>;
  remove(paths: string[]): Promise<StorageResult<unknown[]>>;
}

interface SupabaseStorageClient {
  storage: {
    from(bucket: string): SupabaseStorageBucket;
  };
}

export const SUPABASE_STORAGE_BUCKET = "arquivos";
const SIGNED_READ_URL_TTL_SECONDS = 60 * 60;

export function getObjectStorageConfig(): {
  supabaseUrl: string;
  secretKey: string;
  bucket: typeof SUPABASE_STORAGE_BUCKET;
} {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL.");
  }
  const isLocalHttp =
    parsedUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== "https:" && !isLocalHttp) {
    throw new Error("SUPABASE_URL must use HTTPS outside localhost.");
  }

  return {
    supabaseUrl: parsedUrl.origin,
    secretKey,
    bucket: SUPABASE_STORAGE_BUCKET,
  };
}

export function createObjectStorageClient(): SupabaseStorageClient {
  const config = getObjectStorageConfig();
  return createClient(config.supabaseUrl, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }) as unknown as SupabaseStorageClient;
}

// Initialize only when storage is first used so tests and non-storage routes
// can start without Supabase Storage credentials.
let sharedClient: SupabaseStorageClient | undefined;

function getClient(): SupabaseStorageClient {
  sharedClient ??= createObjectStorageClient();
  return sharedClient;
}

export function getPublicObjectSearchPaths(): string[] {
  return Array.from(
    new Set(
      (process.env.SUPABASE_STORAGE_PUBLIC_PREFIXES || "public")
        .split(",")
        .map(normalizePrefix)
        .filter(Boolean),
    ),
  );
}

export class ObjectStorageService {
  constructor(private readonly client?: SupabaseStorageClient) {}

  private get clientInstance(): SupabaseStorageClient {
    return this.client ?? getClient();
  }

  private get bucket(): SupabaseStorageBucket {
    return this.clientInstance.storage.from(SUPABASE_STORAGE_BUCKET);
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    const relativePath = normalizeObjectKey(filePath);
    if (!relativePath) return null;

    for (const prefix of getPublicObjectSearchPaths()) {
      const file = { key: joinKey(prefix, relativePath) };
      try {
        await this.getObjectEntitySignedReadURL(file, 60);
        return file;
      } catch (error) {
        if (isNotFound(error)) continue;
        throw error;
      }
    }

    return null;
  }

  async downloadObject(
    file: StoredObject,
    cacheTtlSec = 3600,
    isPublic = false,
  ): Promise<Response> {
    const signedUrl = await this.getObjectEntitySignedReadURL(file, 60);
    const response = await fetch(signedUrl);
    if (response.status === 404) throw new ObjectNotFoundError();
    if (!response.ok) {
      throw new Error(
        `Supabase Storage read failed with status ${response.status}.`,
      );
    }

    const headers = new Headers(response.headers);
    headers.set(
      "Cache-Control",
      `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    );
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/octet-stream");
    }

    return new Response(response.body, { headers });
  }

  async getObjectEntityUploadURL(
    teamId: string,
    contentType: string,
  ): Promise<{ uploadURL: string; objectPath: string }> {
    if (!teamId || teamId.includes("/") || teamId.includes("..")) {
      throw new Error("Invalid team identifier for object storage.");
    }
    if (!contentType.trim()) {
      throw new Error("A content type is required for object uploads.");
    }

    const key = `${teamId}/uploads/${randomUUID()}`;
    const { data, error } = await this.bucket.createSignedUploadUrl(key, {
      upsert: false,
    });
    if (error) throw error;
    if (!data?.signedUrl) {
      throw new Error("Supabase Storage did not return a signed upload URL.");
    }

    return { uploadURL: data.signedUrl, objectPath: `/objects/${key}` };
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    const key = objectPathToKey(objectPath);
    if (!key) throw new ObjectNotFoundError();
    return { key };
  }

  async getObjectEntitySignedReadURL(
    file: StoredObject,
    expiresIn = SIGNED_READ_URL_TTL_SECONDS,
  ): Promise<string> {
    const { data, error } = await this.bucket.createSignedUrl(
      file.key,
      expiresIn,
    );
    if (error) {
      if (isNotFound(error)) throw new ObjectNotFoundError();
      throw error;
    }
    if (!data?.signedUrl) {
      throw new Error("Supabase Storage did not return a signed read URL.");
    }
    return data.signedUrl;
  }

  async deleteObjectEntity(objectPath: string): Promise<void> {
    const key = objectPathToKey(objectPath);
    if (!key) throw new ObjectNotFoundError();

    const { error } = await this.bucket.remove([key]);
    if (error) throw error;
  }
}

export function objectPathToKey(objectPath: string): string | null {
  if (!objectPath.startsWith("/objects/")) return null;
  return normalizeObjectKey(objectPath.slice("/objects/".length)) || null;
}

function normalizeObjectKey(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, "");
  if (
    !normalized ||
    normalized
      .split("/")
      .some((part) => !part || part === "." || part === "..") ||
    normalized.includes("\\")
  ) {
    return "";
  }
  return normalized;
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+|\/+$/g, "");
}

function joinKey(prefix: string, key: string): string {
  return [normalizePrefix(prefix), normalizeObjectKey(key)]
    .filter(Boolean)
    .join("/");
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    message?: string;
    status?: number;
    statusCode?: string | number;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.status === 404 ||
    candidate.statusCode === 404 ||
    candidate.statusCode === "404" ||
    candidate.$metadata?.httpStatusCode === 404 ||
    Boolean(
      candidate.message &&
        /not found|does not exist/i.test(candidate.message),
    )
  );
}
