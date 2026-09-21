---
name: Workspace-targeted native dependencies
description: Installing native Expo packages in this pnpm monorepo without attaching them to the repository root
---

Native dependencies for the Expo app must be added with the package workspace filter, not from the repository root.

**Why:** A root-level add can place the dependency in the wrong package or fail during the monorepo install, while the mobile app needs the dependency in its own package manifest for Metro and native builds.

**How to apply:** Use the mobile workspace selector when adding an Expo/native package, then run the mobile typecheck and restart the Expo workflow once.