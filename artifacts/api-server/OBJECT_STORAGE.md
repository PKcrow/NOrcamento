# Supabase Storage

Uploads and file reads use the private Supabase Storage bucket `arquivos`.
The API signs short-lived upload and download URLs; file bytes move directly
between the browser and Supabase Storage.

## API service configuration

Set these variables on the API service (for Render, the `NOrcamento` Web
Service, not the `NOrcamento-1` Static Site):

| Variable | Required | Use |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | Preferred server-only Supabase Secret key |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy alias | Accepted if `SUPABASE_SECRET_KEY` is not set |
| `SUPABASE_STORAGE_PUBLIC_PREFIXES` | No | Comma-separated public object prefixes; defaults to `public` |

Create a **private** bucket named `arquivos` before deploying. Never expose
`SUPABASE_SECRET_KEY` or the legacy service-role key to the browser or mobile app.
The API keeps existing database paths such as
`/objects/<team-id>/uploads/<id>` and maps them to the same relative path in the
bucket.

The browser uploads with `PUT` to the signed URL. If the browser reports a CORS
error, allow the published frontend origin and the `PUT` method in the Supabase
Storage CORS settings. Reads are redirected to one-hour signed URLs only after
the API verifies the user and team.

## Moving existing files from Replit

The API runtime does not use the Replit storage sidecar. The one-time migration
script can still read existing source files from the Replit workspace and copy
them to `arquivos`; it never deletes the source objects.

1. In the Replit workspace where the old bucket is available, set `SUPABASE_URL`
   and `SUPABASE_SECRET_KEY` as Replit Secrets. The legacy
   `SUPABASE_SERVICE_ROLE_KEY` name is also accepted.
2. Run a dry run:

   ```sh
   pnpm --filter @workspace/scripts run migrate:object-storage -- --dry-run
   ```

3. Copy the files:

   ```sh
   pnpm --filter @workspace/scripts run migrate:object-storage
   ```

4. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the Render API service.
   Existing `/objects/...` paths in the database do not need to be changed.

The migration reads `PRIVATE_OBJECT_DIR` only as a source location while running
inside Replit. It uses the same relative key in `arquivos`, verifies the copied
file size, and keeps originals in place if a copy fails.
