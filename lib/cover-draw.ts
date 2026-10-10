import type { CoverSpec } from "./types";

export interface CanvasSize {
  id: string;
  label: string;
  w: number;
  h: number;
}

export const CANVAS_SIZES: CanvasSize[] = [
  { id: "cover", label: "Product cover 4:3", w: 1600, h: 1200 },
  { id: "square", label: "Square post 1:1", w: 1080, h: 1080 },
  { id: "story", label: "Story 9:16", w: 1080, h: 1920 },
  { id: "og", label: "Link preview 1.91:1", w: 1200, h: 630 },
];

function cssVarFont(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws the same cover designs the app renders in HTML, so exports match. */
export function drawCover(ctx: CanvasRenderingContext2D, spec: CoverSpec, w: number, h: number) {
  const unit = Math.min(w, h) / 100;
  const pad = unit * 8;
  const display = cssVarFont("--font-bricolage", "sans-serif");
  const mono = cssVarFont("--font-plex-mono", "monospace");

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = spec.bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = spec.accent;
  ctx.strokeStyle = spec.accent;
  let textMaxW = w - pad * 2;
  switch (spec.template) {
    case "split":
      ctx.globalAlpha = 0.9;
      ctx.fillRect(w * 0.62, 0, w * 0.38, h);
      ctx.globalAlpha = 1;
      textMaxW = w * 0.62 - pad * 1.5;
      break;
    case "frame":
      ctx.lineWidth = unit * 0.8;
      roundRect(ctx, unit * 4, unit * 4, w - unit * 8, h - unit * 8, unit * 3);
      ctx.stroke();
      break;
    case "grid": {
      const cell = unit * 5;
      const gap = unit * 2;
      for (let i = 0; i < 9; i++) {
        const x = w - pad - (3 - (i % 3)) * (cell + gap) + gap;
        const y = h - pad - (3 - Math.floor(i / 3)) * (cell + gap) + gap;
        ctx.globalAlpha = i % 4 === 0 ? 1 : 0.25;
        ctx.fillStyle = i % 4 === 0 ? spec.accent : spec.fg;
        roundRect(ctx, x, y, cell, cell, unit);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      textMaxW = w - pad * 2 - (cell + gap) * 3;
      break;
    }
    case "stack":
      ctx.save();
      ctx.translate(w * 0.82, h * 0.85);
      ctx.rotate((12 * Math.PI) / 180);
      ctx.globalAlpha = 0.85;
      roundRect(ctx, -w * 0.35, -h * 0.35, w * 0.7, h * 0.7, unit * 4);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      textMaxW = w * 0.65;
      break;
    case "badge": {
      const r = unit * 9;
      ctx.beginPath();
      ctx.arc(w - pad - r, pad + r, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = spec.bg;
      ctx.font = `700 ${unit * 4}px ${mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NEW", w - pad - r, pad + r);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      break;
    }
  }

  // Title (bottom-left, wrapped)
  ctx.fillStyle = spec.fg;
  const size = unit * (h > w ? 10 : 9);
  ctx.font = `800 ${size}px ${display}`;
  const lines = wrap(ctx, spec.title, textMaxW).slice(0, 4);
  const lineH = size * 1.05;
  let y = h - pad - (spec.template === "block" ? unit * 4 : 0) - (lines.length - 1) * lineH;
  if (spec.subtitle) {
    ctx.font = `500 ${unit * 3}px ${mono}`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(spec.subtitle.toUpperCase(), pad, y - lineH * 0.95);
    ctx.globalAlpha = 1;
  }
  ctx.font = `800 ${size}px ${display}`;
  for (const l of lines) {
    ctx.fillText(l, pad, y);
    y += lineH;
  }
  if (spec.template === "block") {
    ctx.fillStyle = spec.accent;
    roundRect(ctx, pad, h - pad - unit * 1.5, unit * 10, unit * 1.2, unit);
    ctx.fill();
  }
}
