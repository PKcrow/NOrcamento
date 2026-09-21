---
name: EAS GitHub sync manifests
description: Remote EAS builds require current mobile source manifests and the matching pnpm lockfile, not only the latest app configuration.
---

When EAS builds use the connected GitHub repository, synchronize the complete mobile source and every relevant package manifest together with the lockfile. Updating only app.json, eas.json, or a later security commit can leave GitHub with an older mobile package.json, causing frozen-lockfile installation failures before the build starts.

**Why:** The remote build source can differ from the Replit working tree when files were synchronized through separate commits; EAS then validates the remote package manifests against the remote lockfile.

**How to apply:** Before triggering a release build, verify the remote branch contains the current artifacts/mobile source, all workspace package.json files, pnpm-workspace.yaml, pnpm-lock.yaml, and patches. Confirm the EAS build commit hash points to that synchronized tree.