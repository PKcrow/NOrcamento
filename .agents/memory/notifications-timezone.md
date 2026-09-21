---
name: Notification business timezone
description: The timezone and category boundary used for mobile notification buckets.
---

“Today” in notification rules means the calendar day in `America/Sao_Paulo`, not the server’s local timezone. A scheduled order whose time has already passed belongs only to the overdue bucket, while an unstarted order later today belongs to the today bucket.

**Why:** The API may run in UTC, and overlapping today/overdue buckets create duplicate alerts on the phone.

**How to apply:** Keep future notification rules that depend on a calendar day aligned with the business timezone and preserve mutually exclusive buckets where the phone presents them together.