---
name: Clerk Expo Core 3 migration
description: Compatibility guidance for moving the mobile app from the deprecated Clerk Expo package to the Core 3 Expo package.
---

Use `@clerk/expo` for the provider and shared auth hooks. Prefer `useSSO` for OAuth flows because `useOAuth` is deprecated in the Core 3 package. Existing custom email/password forms that depend on the resource-style `useSignIn` API can import that hook from `@clerk/expo/legacy` until the form is rewritten for the signal-based API.

**Why:** Core 3 changes the default `useSignIn` return shape, so a direct import swap breaks existing custom password forms even though the provider and token cache remain compatible.

**How to apply:** Keep the legacy adapter limited to the old custom form, and do not restore `@clerk/clerk-expo`; validate the Expo config plugins and SDK-compatible native dependencies after each Clerk upgrade.