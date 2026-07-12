import { useState } from "react";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import { toServableObjectUrl } from "@/lib/objectUrl";
import { compressImage } from "@/lib/imageCompression";

// Target size we upload/store — images are compressed client-side to fit
// this before upload, so users never have to manually shrink phone photos.
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
// Upper bound on the *original* file we'll even attempt to process, mostly
// to avoid hanging the browser on absurdly large raw files.
export const MAX_ORIGINAL_SIZE_BYTES = 30 * 1024 * 1024; // 30MB
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Uploads a file directly to object storage using a presigned URL, then
 * returns a URL the browser can load through the API server. Images are
 * resized/compressed client-side first so large phone photos still fit
 * within MAX_UPLOAD_SIZE_BYTES.
 */
export function useFileUpload() {
  const requestUploadUrl = useRequestUploadUrl();
  const [isCompressing, setIsCompressing] = useState(false);

  const upload = async (
    file: File,
    options: { maxDimension: number; preserveTransparency: boolean } = { maxDimension: 1920, preserveTransparency: false },
  ): Promise<string> => {
    setIsCompressing(true);
    let toSend: File;
    try {
      toSend = await compressImage(file, {
        targetBytes: MAX_UPLOAD_SIZE_BYTES,
        maxDimension: options.maxDimension,
        preserveTransparency: options.preserveTransparency,
      });
    } finally {
      setIsCompressing(false);
    }

    const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
      data: { name: toSend.name, size: toSend.size, contentType: toSend.type },
    });

    const putResponse = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": toSend.type },
      body: toSend,
    });
    if (!putResponse.ok) {
      throw new Error("Falha ao enviar o arquivo.");
    }

    return toServableObjectUrl(objectPath);
  };

  return { upload, isUploading: requestUploadUrl.isPending || isCompressing };
}
