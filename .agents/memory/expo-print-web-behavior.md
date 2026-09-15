---
name: Expo Print web behavior
description: The Expo Print web implementation does not create PDF files.
---

On Expo Web, `printToFileAsync` delegates to the browser's `window.print()` and does not return a generated PDF URI. To preserve an HTML document's complete visual layout, render that HTML in an isolated popup or iframe and print that document instead of converting it to plain text.

**Why:** Treating the web print result as a file produced a zero-byte document. A custom text-only PDF avoided the empty file but discarded the quote's visual layout. Printing the isolated styled HTML was confirmed to work.

**How to apply:** Branch on the platform before calling Expo Print; print an isolated styled document on web and verify native files before sharing them.