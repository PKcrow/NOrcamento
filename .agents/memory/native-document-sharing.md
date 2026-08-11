---
name: Native document sharing
description: The app's approach for sharing generated PDFs through Android's native app chooser.
---

For documents the user wants to send through WhatsApp, Telegram, Gmail, or another installed app,
the browser needs to share a real `File`, not just a URL or a text link.

**Rule:** generate the PDF as a browser `File` with MIME type `application/pdf`, then call
`navigator.share({ files: [file], title, text })` only when
`navigator.canShare({ files: [file] })` returns true. Use the native chooser supplied by Android;
do not hardcode individual app integrations.

**Why:** Android Chrome can route a shared PDF to all compatible installed apps, while URL-only
sharing often sends a link instead of the actual document. Some browsers do not support file
sharing, so silently failing is bad UX.

**How to apply:** reuse the shared PDF generator/share helper in `artifacts/web/src/lib/documentPdf.ts`;
when file sharing is unavailable, download the PDF and tell the user to attach it manually.