---
name: Mobile startup error boundary
description: Why Expo startup fallbacks must surround font and auth initialization
---

The outermost error boundary in the Expo root must wrap the component that calls `useFonts` and initializes `ClerkProvider`. A boundary returned later by that same component cannot catch errors thrown by its own hooks or earlier bootstrap work.

**Why:** In a production Android build, an exception during root bootstrap can hide the splash and leave a blank native surface without reaching an inner boundary. This is especially difficult to diagnose because the web preview may continue to work.

**How to apply:** Keep the root component as a boundary wrapper and place font loading, splash handling, environment validation, and Clerk initialization in its child. Make the fallback hide the splash explicitly and avoid depending on loaded custom fonts.