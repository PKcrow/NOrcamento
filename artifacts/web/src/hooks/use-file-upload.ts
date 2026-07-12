import { useRequestUploadUrl } from "@workspace/api-client-react";
import { toServableObjectUrl } from "@/lib/objectUrl";

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Uploads a file directly to object storage using a presigned URL, then
 * returns a URL the browser can load through the API server.
 */
export function useFileUpload() {
  const requestUploadUrl = useRequestUploadUrl();

  const upload = async (file: File): Promise<string> => {
    const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
      data: { name: file.name, size: file.size, contentType: file.type },
    });

    const putResponse = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putResponse.ok) {
      throw new Error("Falha ao enviar o arquivo.");
    }

    return toServableObjectUrl(objectPath);
  };

  return { upload, isUploading: requestUploadUrl.isPending };
}
