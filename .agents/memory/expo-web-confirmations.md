---
name: Destructive confirmations on Expo Web
description: How confirmation dialogs must differ between native Expo and its web build.
---

For destructive actions in the Expo app, use the browser confirmation API on web and React Native's multi-button alert on Android/iOS.

**Why:** A multi-button React Native alert displayed in Expo Web did not invoke the destructive callback, so tapping delete never sent the API request.

**How to apply:** Branch on the platform before displaying confirmation whenever the confirmed callback creates, updates, or deletes data.