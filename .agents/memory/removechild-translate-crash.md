---
name: removeChild crash from browser translation/extensions
description: React apps can crash with "Failed to execute 'removeChild'/'insertBefore' on 'Node'" when the browser's page-translate feature or certain extensions mutate the DOM outside React's control — not an app logic bug.
---

Symptom: intermittent, hard-to-reproduce full-page crash (blank/white screen, or the
Replit dev runtime-error overlay showing `NotFoundError: Failed to execute 'removeChild'
on 'Node': the node to be removed is not a child of this node`). Happens on interactive
actions (selecting a dropdown item, submitting a form) more often on mobile Chrome.

**Why:** Chrome's "Translate this page" (and some extensions like Grammarly/ad
blockers) swap DOM text nodes/elements outside React's reconciliation. When React
later tries to remove/insert a node it still thinks is there, the browser throws
because the node was already moved/replaced — this is a well-documented upstream
issue (see radix-ui/primitives and many React repos), not a bug in the app's own
component logic. Confirmed via live workflow + browser logs correlating the crash
with Products/Clients navigation (Select/Dialog interactions) on Android Chrome.

**How to apply:**
1. Discourage translation: add `translate="no"` on `<html>`, a `<meta name="google"
   content="notranslate">` tag, and `class="notranslate"` on `<body>` in `index.html`.
2. Add a defensive patch at app entry (before `createRoot(...).render`) that wraps
   `Node.prototype.removeChild`/`insertBefore` to no-op instead of throwing when the
   target node isn't where the DOM/React expects — see `artifacts/web/src/lib/domPatch.ts`
   for the reference implementation.
3. Still wrap routes in a React `ErrorBoundary` as a last-resort safety net so any
   render-phase crash shows a "reload" UI instead of a permanently frozen page.
4. Don't waste time trying to find a "real" root-cause bug in the feature code (form
   validation, API calls, etc.) once logs show the error is a `removeChild`/
   `insertBefore` DOMException uncorrelated with any specific business logic path.
