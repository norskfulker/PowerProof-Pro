import { editMock, flattenText, hashString, paletteFor, renderMock } from "../ai/render";
import { assetUrl, putAsset } from "../media/store";
import { commit, db, getDemo } from "../mock/db";
import { uid } from "../mock/random";
import { AI_COSTS, PLAN_LIMITS } from "../plans";
import type { AiCredits, AiGeneration, AiImage, AiRequest, AiTextLayer, MediaItem } from "../types";
import { LimitError } from "./account";
import { ApiError, call, notFound } from "./client";
import { saveGeneratedMedia } from "./media";

/**
 * AI image maker (Part 6E). Every screen talks to these functions only. The current internals are a
 * believable mock (canvas pictures after a 3 to 6 second wait); a real image provider replaces the
 * body of `produce` and `transform` without changing any signature. No provider is named here.
 */

const MAX_HISTORY = 20;
const month = () => new Date().toISOString().slice(0, 7);

function credits(): AiCredits {
  const d = db();
  const limit = PLAN_LIMITS[d.plan.tier ?? "pro"].aiCredits;
  const used = d.aiCreditsUsed?.month === month() ? d.aiCreditsUsed.used : 0;
  return { month: month(), used, limit };
}

export function getAiCredits(): Promise<AiCredits> {
  return call(credits, { fast: true });
}

export function getAiHistory(): Promise<AiGeneration[]> {
  return call(() => db().aiHistory, { fast: true });
}

function spend(cost: number) {
  const c = credits();
  if (c.used + cost > c.limit) throw new LimitError("aiCredits", "You've used this month's AI image credits.");
}

function charge(cost: number) {
  commit((d) => {
    const used = d.aiCreditsUsed?.month === month() ? d.aiCreditsUsed.used : 0;
    d.aiCreditsUsed = { month: month(), used: used + cost };
  });
}

async function wait(signal?: AbortSignal) {
  const ms = 3000 + Math.random() * 3000;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Cancelled", "AbortError"));
    });
  });
  if (getDemo().fail) throw new ApiError("The image service didn't respond. Your prompt is still here; try again in a moment.");
}

function record(gen: AiGeneration) {
  commit((d) => {
    d.aiHistory = [gen, ...(d.aiHistory ?? [])].slice(0, MAX_HISTORY);
  });
}

async function produce(req: AiRequest, seeds: number[], op: AiImage["op"]): Promise<AiImage[]> {
  const referenceUrl = req.reference ? await assetUrl(req.reference) : undefined;
  const out: AiImage[] = [];
  for (const seed of seeds) {
    const { blob, width, height } = await renderMock({ prompt: req.prompt, style: req.style, aspect: req.aspect, seed, palette: paletteFor(req.prompt, req.brandColors, seed), referenceUrl });
    const src = await putAsset(new File([blob], "ai.png", { type: "image/png" }));
    out.push({ id: uid("ai"), src, width, height, op, seed });
  }
  return out;
}

export function validatePrompt(prompt: string): string | undefined {
  const p = prompt.trim();
  if (p.length < 3) return "Describe the picture in a few words.";
  if (p.length > 600) return "Keep the description under 600 characters.";
  return undefined;
}

/** Four variations for a prompt. Costs 1 credit. Cancel with `signal`. */
export async function generateImage(req: AiRequest, opts: { signal?: AbortSignal } = {}): Promise<AiGeneration> {
  const problem = validatePrompt(req.prompt);
  if (problem) throw new ApiError(problem, "validation");
  spend(AI_COSTS.generate);
  await wait(opts.signal);
  const base = hashString(req.prompt + req.style + req.aspect) + Date.now() % 997;
  const images = await produce(req, [0, 1, 2, 3].map((i) => base + i * 7919), "generate");
  const gen: AiGeneration = { id: uid("gen"), at: new Date().toISOString(), request: req, images };
  charge(AI_COSTS.generate);
  record(gen);
  return gen;
}

export type AiOp = "regenerate" | "vary" | "edit" | "remove_bg" | "replace_bg" | "upscale";

function find(generationId: string, imageId: string): { gen: AiGeneration; img: AiImage } {
  const gen = db().aiHistory.find((g) => g.id === generationId) ?? notFound("Image");
  const img = gen.images.find((i) => i.id === imageId) ?? notFound("Image");
  return { gen, img };
}

/**
 * Works on one picture: regenerate (a fresh take on the same prompt), vary (four close cousins),
 * edit by instruction, remove or replace the background, or upscale (twice the size). 1 credit each.
 */
export async function transformImage(op: AiOp, generationId: string, imageId: string, opts: { instruction?: string; signal?: AbortSignal } = {}): Promise<AiGeneration> {
  const { gen, img } = find(generationId, imageId);
  if (op === "edit" && (opts.instruction ?? "").trim().length < 3) throw new ApiError("Say what to change, like “make the background darker”.", "validation");
  spend(AI_COSTS[op === "remove_bg" || op === "replace_bg" ? "removeBackground" : op]);
  await wait(opts.signal);
  let images: AiImage[];
  if (op === "regenerate") {
    images = await produce(gen.request, [img.seed + 104729], "regenerate");
  } else if (op === "vary") {
    images = await produce(gen.request, [1, 2, 3, 4].map((i) => img.seed + i), "vary");
  } else {
    const url = await assetUrl(img.src);
    if (!url) throw new ApiError("That picture isn't available on this device any more. Generate a new one.", "not_found");
    const { blob, width, height } = await editMock(url, opts.instruction ?? "", op, paletteFor(gen.request.prompt, gen.request.brandColors, img.seed));
    const src = await putAsset(new File([blob], "ai.png", { type: "image/png" }));
    images = [{ id: uid("ai"), src, width, height, op, instruction: opts.instruction?.trim(), seed: img.seed }];
  }
  const next: AiGeneration = { id: uid("gen"), at: new Date().toISOString(), request: gen.request, images };
  charge(1);
  record(next);
  return next;
}

/** Report an image that copies a brand, logo or real person. Hidden from history and flagged for review. */
export function reportAiImage(generationId: string, imageId: string): Promise<void> {
  return call(() => {
    const { img } = find(generationId, imageId);
    commit(() => (img.reported = true));
  }, { fast: true });
}

/** Saves a picture (with any text layer baked in) to the media library. */
export async function saveAiImage(generationId: string, imageId: string, opts: { textLayer?: AiTextLayer; alt?: string } = {}): Promise<MediaItem> {
  const { gen, img } = find(generationId, imageId);
  const url = await assetUrl(img.src);
  if (!url) throw new ApiError("That picture isn't available on this device any more. Generate a new one.", "not_found");
  let blob: Blob;
  let width = img.width;
  let height = img.height;
  if (opts.textLayer?.text.trim()) {
    const flat = await flattenText(url, opts.textLayer);
    blob = flat.blob;
    width = flat.width;
    height = flat.height;
  } else {
    blob = await (await fetch(url)).blob();
  }
  const name = gen.request.prompt.trim().slice(0, 48) || "AI image";
  return saveGeneratedMedia(blob, { name, prompt: gen.request.prompt, width, height, alt: opts.alt });
}

export const EXAMPLE_PROMPTS = [
  "A calm Notion workspace on a desk with morning light, soft greens",
  "Bold cover for an ebook about pricing freelance work, gold and deep green",
  "Playful shapes for a kids' bedtime stories collection, pastel colours",
  "Minimal banner for a Lightroom preset sale, warm sunset tones",
  "Illustrated hills at dusk for a study notes store",
  "Photographic flat lay of a planner, a cup of chai and a pen",
];
