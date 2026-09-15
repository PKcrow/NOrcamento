---
name: Public web links from mobile
description: Domain separation required when a mobile artifact shares links to web routes.
---

Customer-facing links created by the published mobile app must use the explicit published web domain, never the Expo preview host. Preview builds must remain on the development domain because their records live in the development database.

**Why:** Expo uses a separate host and service route. Development links are temporary and may be inaccessible when the workspace stops. Pointing a development token at the production domain also fails because development and production databases are separate.

**How to apply:** Keep the API base domain and web-link domain as separate build-time variables. Production builds must set the web-link variable to the verified deployment domain. Treat preview sharing as internal testing only; send customer links from the published app.