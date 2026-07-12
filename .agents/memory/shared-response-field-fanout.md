---
name: Adding a field to a shared response shape
description: Why adding a field to one entity type can 500 unrelated routes, and how to avoid it.
---

When an entity (e.g. a `Task`) is embedded in more than one API response — e.g. `GET /tasks`
returns tasks, but so do `GET /notifications` (overdue/due-soon tasks) and
`GET /dashboard/summary` (upcoming tasks) — each route in this codebase independently re-shapes
the raw DB row into the response object (adding `clientName`, etc.) rather than sharing one
mapper. Adding a new required field to the shared Zod schema (e.g. `photos: TaskPhoto[]`) makes
codegen require it on *every* response that uses that schema, but only the route you edited gets
the field added to its hand-rolled shaping function.

**Why:** the other routes' `tsc` typecheck still passes (they select raw DB columns typed loosely
enough, or spread `...task`), so the omission isn't caught until runtime — Zod's `.parse()` throws
`invalid_type ... path: [..., "photos"], message: "Required"` and the endpoint 500s.

**How to apply:** after adding a field to a shared entity schema in `openapi.yaml`, grep the API
server routes for every place that constructs that entity (not just the "main" CRUD route for it)
and backfill the new field there too. In this project that meant `tasks.ts`, `notifications.ts`,
and `dashboard.ts` all needed their own `photos: [...]` attachment logic.
