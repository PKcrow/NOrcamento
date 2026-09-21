---
name: Expo Playwright host compatibility
description: Host binding accepted by the current Expo CLI when Playwright starts Expo Web.
---

Playwright's Expo Web server should start with the Expo host mode `localhost` in this workspace. The current Expo CLI rejects an explicit `0.0.0.0` host before serving the app.

**Why:** The E2E runner otherwise fails during web-server startup, before it can discover or execute any test, even though the application code is healthy.

**How to apply:** Keep the Playwright webServer command on `--host localhost`; use the test base URL separately for the browser connection.