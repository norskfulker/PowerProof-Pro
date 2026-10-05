/**
 * Mock image renderer for the AI image maker. Draws believable, varied pictures on a canvas from
 * the request (prompt words, style, aspect, brand colours, optional reference image) and a seed.
 * Only `lib/api/ai.ts` uses this; swapping in a real provider means replacing that file's internals.
 */
import type { AiAspect, AiStyle } from "../types";

export const ASPECT_SIZE: Record<AiAspect, [number, number]> = {
  "1:1": [768, 768],
  "4:5": [720, 900],
  "16:9": [1024, 576],
  "3:1": [1200, 400],
};

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const WORD_COLORS: [RegExp, string[]][] = [
  [/\b(ocean|sea|blue|sky|water|calm)\b/i, ["#0E4A5C", "#1D5C7A", "#7FB7C9", "#E8F1F4"]],
  [/\b(forest|green|plant|leaf|nature|notion)\b/i, ["#0F3D33", "#3F7A66", "#A9C8B4", "#EEF4EF"]],
  [/\b(sunset|warm|golden|orange|autumn|diwali|festive)\b/i, ["#8A3B1E", "#E0A43B", "#F3C98B", "#FBEFDC"]],
  [/\b(night|dark|moody|black|luxury)\b/i, ["#0C1F1B", "#1E2A4A", "#4A2545", "#C9A24F"]],
  [/\b(pink|rose|soft|pastel|wedding)\b/i, ["#C98A6B", "#EEE3EC", "#F7D6D0", "#4A2545"]],
  [/\b(study|book|ebook|notes|planner|paper)\b/i, ["#F6EFDF", "#C9A24F", "#1E2A4A", "#E8E1D0"]],
];

export function paletteFor(prompt: string, brand?: string[], seed = 0): string[] {
  if (brand?.length) {
    const b = [...brand];
    while (b.length < 4) b.push(["#F5F6F4", "#0C1F1B", "#C9A24F"][b.length % 3]);
    return b.slice(0, 4);
  }
  for (const [re, cols] of WORD_COLORS) if (re.test(prompt)) return cols;
  const sets = [
    ["#0F3D33", "#C9A24F", "#F5F6F4", "#3F7A66"],
    ["#1E2A4A", "#D08C3A", "#F4F5F8", "#7FB7C9"],
    ["#4A2545", "#C98A6B", "#F7F4F6", "#E0A43B"],
    ["#8A3B1E", "#3F7A66", "#F8F4F0", "#E0A43B"],
  ];
  return sets[(hashString(prompt) + seed) % sets.length];
}

async function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

/** Draws one picture. Returns a PNG blob. */
export async function renderMock(o: { prompt: string; style: AiStyle; aspect: AiAspect; seed: number; palette: string[]; referenceUrl?: string; scale?: number }): Promise<{ blob: Blob; width: number; height: number }> {
  const [bw, bh] = ASPECT_SIZE[o.aspect];
  const scale = o.scale ?? 1;
  const w = Math.round(bw * scale);
  const h = Math.round(bh * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const r = rng(o.seed);
  const [a, b, light, d] = o.palette;
  const pick = () => o.palette[Math.floor(r() * o.palette.length)];

  // Base
  const g = ctx.createLinearGradient(0, 0, w * (0.5 + r()), h);
  g.addColorStop(0, o.style === "minimal" ? light : a);
  g.addColorStop(1, o.style === "minimal" ? light : o.style === "photographic" ? d : b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (o.referenceUrl) {
    const ref = await loadImage(o.referenceUrl);
    if (ref) {
      ctx.globalAlpha = 0.35;
      const s = Math.max(w / ref.width, h / ref.height);
      ctx.drawImage(ref, (w - ref.width * s) / 2, (h - ref.height * s) / 2, ref.width * s, ref.height * s);
      ctx.globalAlpha = 1;
    }
  }

  const m = Math.min(w, h);
  switch (o.style) {
    case "clean": {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = pick();
        ctx.globalAlpha = 0.85;
        const rw = m * (0.25 + r() * 0.35);
        ctx.beginPath();
        ctx.roundRect(w * (0.1 + r() * 0.6), h * (0.1 + r() * 0.5), rw, rw * (0.6 + r() * 0.6), m * 0.04);
        ctx.fill();
      }
      break;
    }
    case "bold": {
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? light : pick();
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((r() - 0.5) * 0.8);
        ctx.fillRect(-w, (i - 3) * m * 0.14, w * 2, m * 0.08);
        ctx.restore();
      }
      ctx.fillStyle = d;
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.45, m * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "playful": {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = pick();
        ctx.globalAlpha = 0.75 + r() * 0.25;
        ctx.beginPath();
        ctx.ellipse(w * r(), h * r(), m * (0.04 + r() * 0.14), m * (0.04 + r() * 0.12), r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "minimal": {
      ctx.fillStyle = a;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(w * (0.35 + r() * 0.3), h * (0.4 + r() * 0.2), m * (0.16 + r() * 0.08), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b;
      ctx.fillRect(w * 0.1, h * 0.82, w * 0.8, Math.max(2, m * 0.006));
      break;
    }
    case "photographic": {
      // Soft light and bokeh, then a gentle vignette
      for (let i = 0; i < 26; i++) {
        const x = w * r(), y = h * r(), rad = m * (0.03 + r() * 0.12);
        const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
        rg.addColorStop(0, light);
        rg.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.15 + r() * 0.35;
        ctx.fillStyle = rg;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      const v = ctx.createRadialGradient(w / 2, h / 2, m * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      v.addColorStop(0, "transparent");
      v.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "illustration": {
      for (let layer = 0; layer < 4; layer++) {
        ctx.fillStyle = o.palette[(layer + 1) % 4];
        ctx.globalAlpha = 1;
        ctx.beginPath();
        const base = h * (0.45 + layer * 0.14);
        ctx.moveTo(0, h);
        ctx.lineTo(0, base);
        for (let x = 0; x <= w; x += w / 8) ctx.quadraticCurveTo(x + w / 16, base - m * (0.05 + r() * 0.12), x + w / 8, base + (r() - 0.5) * m * 0.06);
        ctx.lineTo(w, h);
        ctx.fill();
      }
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(w * (0.2 + r() * 0.6), h * 0.22, m * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.globalAlpha = 1;
  const blob = await new Promise<Blob>((res) => c.toBlob((x) => res(x!), "image/png"));
  return { blob, width: w, height: h };
}

/** Applies an instruction like "make the background darker" to an existing picture. */
export async function editMock(srcUrl: string, instruction: string, op: "edit" | "remove_bg" | "replace_bg" | "upscale", palette: string[]): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(srcUrl);
  if (!img) throw new Error("unreadable");
  const scale = op === "upscale" ? 2 : 1;
  const w = img.width * scale;
  const h = img.height * scale;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const t = instruction.toLowerCase();
  if (op === "edit") {
    const filters: string[] = [];
    if (/dark/.test(t)) filters.push("brightness(0.75)");
    if (/light|bright/.test(t)) filters.push("brightness(1.2)");
    if (/warm/.test(t)) filters.push("sepia(0.35) saturate(1.2)");
    if (/cool|blue/.test(t)) filters.push("hue-rotate(25deg)");
    if (/contrast|punch|pop/.test(t)) filters.push("contrast(1.3)");
    if (/soft|blur|dreamy/.test(t)) filters.push("blur(2px)");
    if (/black and white|mono|grey|gray/.test(t)) filters.push("grayscale(1)");
    if (/vivid|colou?rful|saturat/.test(t)) filters.push("saturate(1.5)");
    ctx.filter = filters.length ? filters.join(" ") : `hue-rotate(${(hashString(t) % 40) - 20}deg) contrast(1.1)`;
  }
  if (op === "replace_bg") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, palette[0]);
    g.addColorStop(1, palette[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  if (op === "remove_bg" || op === "replace_bg") {
    // Treat pixels close to the corner colour as background
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const [r0, g0, b0] = [px[0], px[1], px[2]];
    const bgPixels: number[] = [];
    for (let i = 0; i < px.length; i += 4) {
      const dist = Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0);
      if (dist < 90) bgPixels.push(i);
    }
    if (op === "remove_bg") {
      for (const i of bgPixels) px[i + 3] = 0;
      ctx.putImageData(data, 0, 0);
    } else {
      const fresh = document.createElement("canvas");
      fresh.width = w;
      fresh.height = h;
      const fx = fresh.getContext("2d")!;
      const g = fx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, palette[2] ?? "#F5F6F4");
      g.addColorStop(1, palette[3] ?? "#C9A24F");
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
      const bg = fx.getImageData(0, 0, w, h).data;
      for (const i of bgPixels) {
        px[i] = bg[i];
        px[i + 1] = bg[i + 1];
        px[i + 2] = bg[i + 2];
      }
      ctx.putImageData(data, 0, 0);
    }
  }
  const blob = await new Promise<Blob>((res) => c.toBlob((x) => res(x!), "image/png"));
  return { blob, width: w, height: h };
}

/** Bakes an editable text layer into the picture with the store's fonts, for "Use this image". */
export async function flattenText(srcUrl: string, layer: { text: string; x: number; y: number; size: "sm" | "md" | "lg"; color: string; font: "display" | "body" }): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(srcUrl);
  if (!img) throw new Error("unreadable");
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const family = (layer.font === "display" ? css.getPropertyValue("--font-display") : css.getPropertyValue("--font-sans")) || "sans-serif";
  const px = Math.round(Math.min(img.width, img.height) * { sm: 0.06, md: 0.09, lg: 0.13 }[layer.size]);
  ctx.font = `${layer.font === "display" ? 800 : 600} ${px}px ${family}`;
  ctx.fillStyle = layer.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = layer.text.split("\n");
  lines.forEach((line, i) => ctx.fillText(line, (layer.x / 100) * img.width, (layer.y / 100) * img.height + (i - (lines.length - 1) / 2) * px * 1.1));
  const blob = await new Promise<Blob>((res) => c.toBlob((x) => res(x!), "image/png"));
  return { blob, width: img.width, height: img.height };
}
