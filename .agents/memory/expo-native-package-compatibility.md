---
name: Expo native package compatibility
description: Native Expo modules must stay on the SDK-compatible version line.
---

When adding a native Expo module, install the version expected by the project's Expo SDK instead of the newest registry release.

**Why:** Expo can bundle a mismatched native module while the typecheck still passes, leaving the development workflow warning or the native build unusable.

**How to apply:** Check the installed Expo SDK's expected package version in the workflow output, then pin the compatible range in the artifact package before validating the app.