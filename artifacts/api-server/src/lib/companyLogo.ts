import { ObjectStorageService } from "./objectStorage";

const objectStorage = new ObjectStorageService();

export function getPrivateCompanyLogoObjectPath(logoUrl: string): string | null {
  let pathname = logoUrl;
  try {
    if (/^https?:\/\//i.test(logoUrl)) pathname = new URL(logoUrl).pathname;
  } catch {
    return null;
  }
  pathname = pathname.split(/[?#]/, 1)[0];

  if (pathname.startsWith("/objects/")) return pathname;
  const objectMatch = pathname.match(/\/api\/(?:storage\/)?objects\/(.+)$/);
  return objectMatch ? `/objects/${objectMatch[1]}` : null;
}

export async function downloadPrivateCompanyLogo(logoUrl: string) {
  const objectPath = getPrivateCompanyLogoObjectPath(logoUrl);
  if (!objectPath) return null;
  const file = await objectStorage.getObjectEntityFile(objectPath);
  return objectStorage.downloadObject(file);
}
