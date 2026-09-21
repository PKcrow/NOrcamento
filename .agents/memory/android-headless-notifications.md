---
name: Android headless notification cleanup
description: Expo Push cannot cancel local Android notifications directly; use a headless data push and a background task with stable task identifiers.
---

Expo Push Service does not expose a server-side cancellation API for a local notification identifier. A production Expo app can react to a high-priority data-only push through `expo-notifications` and `expo-task-manager`, then cancel scheduled and presented notifications by their stable task identifier.

**Why:** A normal remote notification only adds another tray item; it cannot remove a local notification while the app is closed. Android Doze, aggressive battery optimization, network loss, and force-stop can delay or prevent headless delivery.

**How to apply:** Keep the local identifier deterministic per O.S., send payment state changes as headless control pushes, and document that cleanup is best effort until the next app synchronization.

For payment cleanup pushes, treat a missing Expo ticket id or receipt as
unconfirmed, retry only a bounded number of times, and keep the same collapse id
and local notification id on every attempt. Persist failed local cleanup ids so
the next authenticated task synchronization can retry them.

**Why:** A successful HTTP response from Expo is not confirmation that Android
executed the headless task; retries must improve delivery without creating a
second local pending notification.

**How to apply:** Keep retries scoped to the payment cleanup control push,
discard `DeviceNotRegistered` tokens, and let normal task synchronization remain
the final recovery path after process restarts or Android force-stop.