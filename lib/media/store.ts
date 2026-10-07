/**
 * What media files a store takes, and checks run in the browser before upload. The files
 * themselves live in Supabase Storage (see lib/api/media.ts).
 */

export const MB = 1024 * 1024;

export const MEDIA_LIMITS = {
  image: { max: 5 * MB, types: ["image/jpeg", "image/png", "image/webp"], label: "JPG, PNG or WebP up to 5 MB" },
  gif: { max: 5 * MB, types: ["image/gif"], label: "GIF up to 5 MB" },
  video: { max: 10 * MB, types: ["video/mp4", "video/webm"], label: "MP4 or WebM up to 10 MB" },
} as const;

export type MediaKind = keyof typeof MEDIA_LIMITS;

export function mediaKindOf(type: string): MediaKind | undefined {
  return (Object.keys(MEDIA_LIMITS) as MediaKind[]).find((k) => (MEDIA_LIMITS[k].types as readonly string[]).includes(type));
}

/** Plain-words problem with a file, or undefined if it's fine for one of the allowed kinds. */
export function checkMedia(file: { name: string; size: number; type: string }, allowed: MediaKind[]): string | undefined {
  const kind = mediaKindOf(file.type);
  if (!kind || !allowed.includes(kind)) return `${file.name} isn't a file type this block takes. Use ${allowed.map((k) => MEDIA_LIMITS[k].label).join(", or ")}.`;
  if (file.size > MEDIA_LIMITS[kind].max) return `${file.name} is ${(file.size / MB).toFixed(1)} MB. ${kind === "video" ? "Videos" : kind === "gif" ? "GIFs" : "Images"} can be up to ${MEDIA_LIMITS[kind].max / MB} MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return undefined;
}

/** Width and height of an image or video file, when the browser can read them. */
export async function measureMedia(file: Blob, kind: MediaKind): Promise<{ width?: number; height?: number }> {
  try {
    if (kind === "video") {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(new Error("unreadable"));
        setTimeout(() => resolve(), 3000);
      });
      URL.revokeObjectURL(url);
      return { width: v.videoWidth || undefined, height: v.videoHeight || undefined };
    }
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch {
    return {};
  }
}
