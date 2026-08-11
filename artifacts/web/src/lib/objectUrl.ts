const basePath = import.meta.env.BASE_URL;

/**
 * Turns an object-storage entity path (e.g. "/objects/uuid") returned by
 * POST /storage/uploads/request-url into a URL the browser can load
 * directly (through the API server's serving route), honoring the
 * artifact's base path prefix.
 */
export function toServableObjectUrl(objectPath: string): string {
  if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) {
    return normalizeStoredObjectUrl(objectPath);
  }

  return `${basePath}api/storage${objectPath}`;
}

/**
 * Normalizes URLs saved before the storage route included `/storage`.
 * This keeps existing company logos and task photos working after the route
 * correction, without requiring users to upload them again.
 */
export function normalizeStoredObjectUrl(url: string): string {
  if (!url) return url;

  const oldRoute = `${basePath}api/objects/`;
  const currentRoute = `${basePath}api/storage/objects/`;
  if (url.startsWith(oldRoute)) {
    return `${currentRoute}${url.slice(oldRoute.length)}`;
  }

  if (url.startsWith("/objects/")) {
    return `${basePath}api/storage${url}`;
  }

  // Also handle an absolute URL saved by an older client build while keeping
  // its origin intact.
  if (url.includes("/api/objects/")) {
    return url.replace("/api/objects/", "/api/storage/objects/");
  }

  return url;
}
