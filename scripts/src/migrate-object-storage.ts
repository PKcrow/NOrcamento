import { Storage } from "@google-cloud/storage";
import { createClient } from "@supabase/supabase-js";

const SIDECAR_URL = "http://127.0.0.1:1106";
const SUPABASE_STORAGE_BUCKET = "arquivos";

function createLegacyStorageClient(): Storage {
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${SIDECAR_URL}/token`,
      type: "external_account",
      credential_source: {
        url: `${SIDECAR_URL}/credential`,
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "replit",
  });
}

function parseLegacyPrivateDir(value: string): {
  bucket: string;
  prefix: string;
} {
  const parts = value.replace(/^\/+|\/+$/g, "").split("/");
  const bucket = parts.shift();
  if (!bucket) {
    throw new Error("PRIVATE_OBJECT_DIR must start with /<bucket-name>.");
  }
  return { bucket, prefix: parts.join("/") };
}

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secretKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SECRET_KEY for the destination bucket.",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function migrate() {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    throw new Error(
      "PRIVATE_OBJECT_DIR is required on Replit while reading the existing files.",
    );
  }
  const source = parseLegacyPrivateDir(privateDir);
  const supabase = createSupabaseClient();
  const destination = supabase.storage.from(SUPABASE_STORAGE_BUCKET);
  const dryRun = process.argv.includes("--dry-run");

  const legacyStorage = createLegacyStorageClient();
  const [files] = await legacyStorage
    .bucket(source.bucket)
    .getFiles({ prefix: source.prefix, autoPaginate: true });

  let copied = 0;
  let skipped = 0;
  for (const file of files) {
    const relativeKey = source.prefix
      ? file.name.slice(source.prefix.length).replace(/^\/+/, "")
      : file.name;
    if (
      !relativeKey ||
      relativeKey.split("/").some((part) => part === "." || part === "..")
    ) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      copied += 1;
      continue;
    }

    const [metadata] = await file.getMetadata();
    const [contents] = await file.download();
    const { error: uploadError } = await destination.upload(
      relativeKey,
      contents,
      {
        contentType: metadata.contentType || "application/octet-stream",
        cacheControl: "3600",
        upsert: true,
      },
    );
    if (uploadError) throw uploadError;

    const { data: verification, error: verifyError } =
      await destination.download(relativeKey);
    if (verifyError) throw verifyError;
    if (
      metadata.size !== undefined &&
      verification.size !== Number(metadata.size)
    ) {
      throw new Error(
        `Size verification failed for migrated object ${relativeKey}.`,
      );
    }
    copied += 1;
  }

  console.info(
    dryRun
      ? `Dry run complete: ${copied} objects ready to copy, ${skipped} skipped.`
      : `Migration complete: ${copied} copied, ${skipped} skipped. Original objects were not deleted.`,
  );
}

migrate().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("Object storage migration failed:", message);
  process.exitCode = 1;
});
