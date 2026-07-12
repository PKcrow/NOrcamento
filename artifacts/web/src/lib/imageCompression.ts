/**
 * Client-side image compression.
 *
 * Phone cameras routinely produce 8-20MB photos, far above what we want to
 * store/serve. Rather than asking users to shrink photos themselves (or
 * raising the upload cap, which just moves the problem and bloats storage),
 * we resize + re-encode images in the browser before upload so any photo
 * "just works" regardless of the original size.
 */

const MAX_DIMENSION_PHOTO = 1920;
const MAX_DIMENSION_LOGO = 1024;
const QUALITY_STEPS = [0.82, 0.65, 0.5, 0.35];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function drawToCanvas(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao processar a imagem."))),
      mimeType,
      quality,
    );
  });
}

/**
 * Resizes and re-encodes an image file so it fits within `targetBytes`.
 * PNG/WEBP are kept as-is (to preserve transparency) unless they still
 * exceed the target after resizing, in which case we fall back to JPEG.
 */
export async function compressImage(
  file: File,
  { targetBytes, maxDimension, preserveTransparency }: { targetBytes: number; maxDimension: number; preserveTransparency: boolean },
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const img = await loadImage(file);
  const canvas = drawToCanvas(img, maxDimension);

  const keepFormat = preserveTransparency && (file.type === "image/png" || file.type === "image/webp");
  const outputType = keepFormat ? file.type : "image/jpeg";

  let blob = await canvasToBlob(canvas, outputType, outputType === "image/png" ? undefined : QUALITY_STEPS[0]);

  if (blob.size <= targetBytes) {
    return toFile(blob, file.name, outputType);
  }

  // PNG has no quality knob — if still too big, fall back to JPEG.
  const lossyType = outputType === "image/png" ? "image/jpeg" : outputType;
  for (const quality of QUALITY_STEPS) {
    blob = await canvasToBlob(canvas, lossyType, quality);
    if (blob.size <= targetBytes) {
      return toFile(blob, file.name, lossyType);
    }
  }

  // Last resort: shrink dimensions further at the lowest quality.
  const smallerCanvas = drawToCanvas(img, Math.round(maxDimension * 0.6));
  blob = await canvasToBlob(smallerCanvas, lossyType, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
  return toFile(blob, file.name, lossyType);
}

function toFile(blob: Blob, originalName: string, mimeType: string): File {
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const baseName = originalName.replace(/\.[^./]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: mimeType });
}

export { MAX_DIMENSION_PHOTO, MAX_DIMENSION_LOGO };
