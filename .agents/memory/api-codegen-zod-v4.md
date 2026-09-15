---
name: API codegen uses Zod v4 compatibility
description: Orval currently emits zod.int(), so generated validation must import the Zod v4 compatibility entrypoint.
---

Orval's generated Zod validators use the Zod 4 API (`zod.int()`), while the workspace dependency remains on the Zod package that exposes that API through `zod/v4`.

**Why:** Running codegen without this compatibility import makes the shared library typecheck fail across every generated integer field.

**How to apply:** Keep the codegen post-processing/import convention intact whenever regenerating `lib/api-zod`; run the shared library typecheck immediately afterward.