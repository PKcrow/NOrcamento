import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getObjectStorageConfig,
  ObjectNotFoundError,
  ObjectStorageService,
  SUPABASE_STORAGE_BUCKET,
} from "../lib/objectStorage";

describe("ObjectStorageService with Supabase Storage", () => {
  const bucket = {
    createSignedUploadUrl: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
  };
  const from = vi.fn(() => bucket);
  let storage: ObjectStorageService;

  beforeEach(() => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "unit-test-secret-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_STORAGE_PUBLIC_PREFIXES = "public, public-assets";

    bucket.createSignedUploadUrl.mockReset();
    bucket.createSignedUrl.mockReset();
    bucket.remove.mockReset();
    from.mockClear();
    storage = new ObjectStorageService({ storage: { from } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the new Supabase Secret key environment variable", () => {
    expect(getObjectStorageConfig()).toMatchObject({
      supabaseUrl: "https://project.supabase.co",
      secretKey: "unit-test-secret-key",
      bucket: SUPABASE_STORAGE_BUCKET,
    });
  });

  it("accepts the legacy service-role variable as a fallback", () => {
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-legacy-key";
    expect(getObjectStorageConfig().secretKey).toBe("unit-test-legacy-key");
  });

  it("creates a team-scoped signed upload URL in the arquivos bucket", async () => {
    bucket.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl:
          "https://project.supabase.co/storage/v1/object/upload/sign/arquivos/team-123/uploads/file",
        token: "upload-token",
        path: "team-123/uploads/file",
      },
      error: null,
    });

    const result = await storage.getObjectEntityUploadURL(
      "team-123",
      "image/png",
    );

    expect(from).toHaveBeenCalledWith(SUPABASE_STORAGE_BUCKET);
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^team-123\/uploads\/.+$/),
      { upsert: false },
    );
    expect(result.objectPath).toMatch(/^\/objects\/team-123\/uploads\/.+$/);
    expect(result.uploadURL).toContain("/object/upload/sign/arquivos/");
  });

  it("maps existing object paths to bucket keys and signs reads", async () => {
    bucket.createSignedUrl.mockResolvedValue({
      data: {
        signedUrl:
          "https://project.supabase.co/storage/v1/object/sign/arquivos/uploads/legacy-file?token=read-token",
      },
      error: null,
    });

    const object = await storage.getObjectEntityFile(
      "/objects/uploads/legacy-file",
    );
    const url = await storage.getObjectEntitySignedReadURL(object, 300);

    expect(object.key).toBe("uploads/legacy-file");
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(
      "uploads/legacy-file",
      300,
    );
    expect(url).toContain("/object/sign/arquivos/");
  });

  it("searches only configured public prefixes", async () => {
    bucket.createSignedUrl
      .mockResolvedValueOnce({
        data: null,
        error: { statusCode: "404", message: "Object not found" },
      })
      .mockResolvedValueOnce({
        data: { signedUrl: "https://project.supabase.co/signed/public-file" },
        error: null,
      });

    const object = await storage.searchPublicObject("logo.png");

    expect(object).toEqual({ key: "public-assets/logo.png" });
    expect(bucket.createSignedUrl).toHaveBeenNthCalledWith(
      1,
      "public/logo.png",
      60,
    );
    expect(bucket.createSignedUrl).toHaveBeenNthCalledWith(
      2,
      "public-assets/logo.png",
      60,
    );
  });

  it("rejects traversal paths before contacting storage", async () => {
    await expect(
      storage.getObjectEntityFile("/objects/team-123/../other/file"),
    ).rejects.toBeInstanceOf(ObjectNotFoundError);
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("downloads through a short-lived signed URL", async () => {
    bucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://project.supabase.co/signed/file" },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("file contents", {
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await storage.downloadObject({
      key: "team-123/uploads/file.pdf",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/signed/file",
    );
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=3600",
    );
    await expect(response.text()).resolves.toBe("file contents");
  });

  it("maps missing signed reads to ObjectNotFoundError", async () => {
    bucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { statusCode: "404", message: "Object not found" },
    });

    await expect(
      storage.getObjectEntitySignedReadURL({ key: "missing.pdf" }),
    ).rejects.toBeInstanceOf(ObjectNotFoundError);
  });

  it("deletes an object from the fixed bucket", async () => {
    bucket.remove.mockResolvedValue({ data: [], error: null });

    await storage.deleteObjectEntity("/objects/team-123/uploads/file.pdf");

    expect(from).toHaveBeenCalledWith("arquivos");
    expect(bucket.remove).toHaveBeenCalledWith([
      "team-123/uploads/file.pdf",
    ]);
  });
});
