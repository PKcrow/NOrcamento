---
name: Expo authenticated E2E isolation
description: Durable pattern for testing Clerk-authenticated Expo Web flows without mutating a real team
---

For authenticated Expo Web browser tests, use a verified Clerk account that belongs only to a reserved E2E team. Keep authentication and profile requests real so the test proves the session, and intercept only the feature data endpoint with local fixtures.

**Why:** A real Clerk session catches routing and startup regressions that API or component tests miss, while fixtureing notification data prevents a repeatable navigation/retry test from creating or changing customer records.

**How to apply:** Require dedicated account/team environment variables, never store credentials or session state in the repository, and make the fixture exercise the loading, error, retry, and settled UI states.