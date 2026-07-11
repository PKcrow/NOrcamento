---
name: Clerk team/multi-tenant workaround
description: How to model shared team access for multiple users when using Replit-managed Clerk, which has no organizations/tenant feature.
---

Replit-managed Clerk does not support organizations or tenants. When a product needs several users to share access to the same business data ("team" access), do not look for a Clerk-side feature — model it entirely in the app's own database instead:

- A `teams` table (name + a unique generated invite code).
- A local `users` bridge table keyed by the Clerk user id (string primary key, not serial), holding `teamId` (nullable until onboarded) and `role`.
- JIT-provision the local `users` row on first authenticated backend request (fetch name/email from Clerk via `clerkClient.users.getUser`), rather than at sign-up time.
- Team creation generates the invite code; joining a team is a separate endpoint that looks up the team by code and sets the user's `teamId`.
- All business data tables get a `teamId` foreign key and every query is scoped by it.

**Why:** Clerk's auth identity and the app's team/tenant concept are separate concerns — Clerk answers "who is this user", the app's own tables answer "what team are they on and what can they see". Conflating them (e.g. trying to store team membership as a Clerk user attribute) doesn't work because Clerk has no first-class multi-tenant primitive today.

**How to apply:** Any time a build needs "multiple users from the same team/org sharing data" and the project uses Clerk for auth, reach for this table-based model directly instead of re-investigating whether Clerk added org support.
