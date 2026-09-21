---
name: EAS GitHub build source
description: EAS builds triggered through the Expo connection read the connected GitHub branch, not the current Replit working tree.
---

EAS `buildRun` uses the repository and branch connected to the Expo project. Local commits are not enough: files that affect the build must be synchronized to that GitHub branch first, and the returned `gitCommitHash` should be checked before trusting the build.

**Why:** A build triggered with `main` can silently use an older remote commit when the workspace and connected GitHub repository have diverged.

**How to apply:** Before an Android/iOS build, verify the remote branch contains the intended app version and configuration, then compare the build's `gitCommitHash` with the synchronized commit.