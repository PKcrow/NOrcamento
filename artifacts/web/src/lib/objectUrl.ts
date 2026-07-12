const basePath = import.meta.env.BASE_URL;

/**
 * Turns an object-storage entity path (e.g. "/objects/uuid") returned by
 * POST /storage/uploads/request-url into a URL the browser can load
 * directly (through the API server's serving route), honoring the
 * artifact's base path prefix.
 */
export function toServableObjectUrl(objectPath: string): string {
  return `${basePath}api${objectPath}`;
}
