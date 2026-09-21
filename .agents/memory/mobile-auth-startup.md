---
name: Mobile auth startup
description: Startup and network-failure behavior for the Expo app's Clerk and current-user loading flow.
---

The mobile app must not treat a pending Clerk initialization or current-user request as an unbounded loading state. API queries that depend on authentication should be disabled until Clerk reports a loaded signed-in session, and startup should expose a retry path when authentication takes unusually long. Native requests have no browser origin, while Expo Web previews do, so local preview origins must be allowed by the API CORS policy. The Clerk proxy is production-only in this API; development Expo must use Clerk directly.

**Why:** A delayed Clerk proxy or a rejected browser preflight otherwise presents only a spinning indicator, making a recoverable network/configuration issue look like an app crash.

**How to apply:** Keep auth-dependent React Query hooks gated by `isLoaded && isSignedIn`, use the proxy only when `__DEV__` is false, allow only required localhost/Expo-preview origins for local web previews, and preserve a visible retry/error state for startup timeouts.