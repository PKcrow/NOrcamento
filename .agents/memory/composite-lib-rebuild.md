---
name: Shared-lib edits need root typecheck:libs before app typecheck
description: Why a fresh export/field added to a lib/* package doesn't appear to app tsc until a root build runs.
---

Packages under `lib/*` (e.g. `@workspace/api-client-react`, `@workspace/db`) use composite
TypeScript project references with `emitDeclarationOnly` + `outDir: dist`. Apps under `artifacts/*`
consume them via project references and resolve types from the built `.d.ts` files, not live source.

**Rule:** after adding/renaming an export, type, or field in any `lib/*` package, run
`pnpm run typecheck:libs` (root `tsc --build`) before running an app's own `typecheck` script.
Otherwise the app's `tsc` reports a stale "no exported member" error even though the source is correct.

**Why:** `tsc --build` is incremental and only regenerates declarations for the libs when invoked;
app-level `tsc -p tsconfig.json --noEmit` doesn't traverse into project references and rebuild them.

**How to apply:** whenever you touch `lib/api-spec/openapi.yaml` (codegen also runs `typecheck:libs`
automatically) or hand-edit any other `lib/*` package's source, run `pnpm run typecheck:libs` at the
repo root before typechecking `artifacts/web` or `artifacts/api-server`.
