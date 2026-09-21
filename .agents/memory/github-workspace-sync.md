---
name: GitHub workspace sync
description: Safe synchronization rules when the GitHub repository and Replit workspace have divergent histories.
---

When syncing a user-edited GitHub repository into this workspace, compare the remote tree with the current worktree before merging. Replit's internal Git history and the connected GitHub repository may have no common ancestor even when their file layout is compatible. Apply matching remote files over the workspace, preserve local-only assets and configuration unless the remote explicitly removes them, and create a local rollback branch before broad replacement.

**Why:** A normal merge can produce mass conflicts or silently replace Replit artifact files when the two histories were created independently.

**How to apply:** Fetch the exact GitHub branch, inspect changed and local-only paths, validate shared libraries first, then run API, web, and mobile typechecks/tests. Fix contract mismatches exposed by the imported generated schemas before restarting workflows.