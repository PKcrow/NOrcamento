---
name: Object storage servable URL convention
description: How to turn a presigned-upload objectPath into a URL the browser can load in this app.
---

The upload flow (`useRequestUploadUrl` → direct `PUT` to the returned `uploadURL`) gives back an
`objectPath` like `/objects/uuid`. That path is only servable through the API server's own route
(mounted at `/api` in `artifacts/api-server/src/app.ts`), not as a bare path.

**Rule:** build the browser-facing URL as `${import.meta.env.BASE_URL}api${objectPath}` (note: no
extra slash — `BASE_URL` already ends in `/`), then store *that* full string wherever the app keeps
a "logo URL" / "photo URL" field (e.g. `company.logoUrl`, `task_photos.url`). Don't store the raw
`objectPath` — reconstructing the prefix at render time everywhere is more error-prone than storing
the final URL once at upload time.

**Why:** the artifact's routes all live behind an `/api` prefix, and the whole app is also served
under an artifact base path in Replit's preview proxy, so a naive `<img src={objectPath}>` 404s.

**How to apply:** reuse `artifacts/web/src/lib/objectUrl.ts` (`toServableObjectUrl`) and
`artifacts/web/src/hooks/use-file-upload.ts` (`useFileUpload`) for any new upload feature instead of
re-deriving this path logic.
