---
name: Large uploads: compress client-side, don't raise the cap
description: Why phone-camera photo uploads should be resized/re-encoded in the browser rather than raising the server's size limit.
---

When users report they can't upload a phone photo because it exceeds the upload size cap, the fix
is client-side compression (resize + re-encode via `<canvas>` before upload), not raising the cap.

**Why:** phone cameras routinely produce 8-20MB photos. Raising the cap to accommodate today's
photo just moves the goalpost for the next larger one, while also bloating storage costs, slowing
uploads on poor mobile connections, and serving oversized images back down to users later. A fixed
target size (e.g. 5MB) achieved via resizing to a reasonable max dimension (~1920px for photos,
~1024px for logos/icons) and JPEG/WEBP quality-stepping gets any camera photo comfortably under
the cap with no visible quality loss for in-app display.

**How to apply:** in this project, `artifacts/web/src/lib/imageCompression.ts` (`compressImage`)
resizes to a max dimension, re-encodes, and iteratively lowers quality until under a target byte
size; `useFileUpload` calls it automatically before every upload. PNG/WEBP inputs are kept in their
original format (to preserve transparency, e.g. logos) unless they're still too large after
resizing, in which case it falls back to lossy JPEG. Keep a separate, more generous "original file"
size ceiling (e.g. 30MB) purely to reject pathological files before the browser tries to decode them.
