/**
 * Photos are shrunk in the browser before they're stored: the longest side is capped and the
 * picture is re-saved as WebP. Only plain JPEG, PNG and WebP are touched. GIFs, videos, PDFs and
 * everything else keep their bytes (re-encoding would lose animation).
 */

export const MAX_EDGE = 2560;
const COMPRESSIBLE = ["image/jpeg", "image/png", "image/webp"];

export interface Compressed {
  file: File;
  /** Bytes saved against the original, 0 when the original was kept */
  saved: number;
}

/** The size to scale to, never enlarging. */
export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const k = max / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

const swapExt = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, "") || "image"}.${ext}`;

export async function compressImage(file: File, quality = 0.82): Promise<Compressed> {
  const keep = { file, saved: 0 };
  if (!COMPRESSIBLE.includes(file.type)) return keep;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return keep;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    // Some browsers can't write WebP and hand back a PNG: that would only make it bigger
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return keep;
    return { file: new File([blob], swapExt(file.name, "webp"), { type: "image/webp", lastModified: file.lastModified }), saved: file.size - blob.size };
  } catch {
    return keep;
  }
}
