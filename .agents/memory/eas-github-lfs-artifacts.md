---
name: EAS builds and generated LFS artifacts
description: Remote EAS builds can fail during repository checkout when generated AAB/APK/ZIP files reference missing Git LFS objects.
---

Generated mobile release archives should not be committed to the application repository used as the EAS build source.

**Why:** EAS clones the GitHub source before building and Git LFS smudge failures happen before Expo can inspect or compile the project. A missing historical archive object can block every new build even when the application code is valid.

**How to apply:** Ignore generated AAB/APK/ZIP files in the repository, remove stale tracked archive pointers from the build branch, and keep downloadable build artifacts in Expo/EAS storage instead of source control.