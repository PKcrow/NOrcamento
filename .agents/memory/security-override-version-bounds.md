---
name: Security override version bounds
description: How to prevent security overrides from silently breaking transitive consumers.
---

Security overrides should resolve to an exact, minimally patched version whenever the consuming package cannot be upgraded at the same time. Do not use an open-ended `>=` replacement.

**Why:** An open-ended replacement can resolve an older transitive dependency to a later major with a different module API, leaving the audit clean while breaking release tooling.

**How to apply:** Use the advisory's lowest patched version, preserve the dependency's existing major when a patch exists there, and smoke-test the direct consumer when a major change is unavoidable.