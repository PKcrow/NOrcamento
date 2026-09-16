---
name: Remote push delivery
description: Background notification delivery, retry behavior, and mobile duplication avoidance.
---

All business alerts that must arrive while the mobile app is closed are sent by the API through Expo Push. The server monitor handles time-based task alerts, while state transitions send immediate alerts. Persist event claims per team and event key so monitor ticks and restarts do not duplicate deliveries; release a claim when the Expo request fails so a later scan can retry. Mobile token registration must be globally guarded across root remounts; unstable mutation identities in an effect dependency can otherwise create an unbounded request loop.

**Why:** Local scheduling cannot reliably represent team-wide state changes and would duplicate alerts once the API sends remote pushes.

**How to apply:** Keep push payloads linkable with `taskId` or `quoteId`, scope tokens to the active team, remove invalid Expo tokens, and clear legacy local schedules when registering the native token. Register at most once per team/session and do not reattach an unbounded token-change listener.