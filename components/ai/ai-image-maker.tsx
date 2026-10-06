"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Eraser, Flag, History, ImagePlus, Loader2, Maximize2, Paintbrush, RefreshCw, Shuffle, Sparkles, Type, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaImg } from "@/components/media/tile-background";
import { usePlan } from "@/components/plan/plan-context";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useMediaUrl } from "@/hooks/use-media-url";
import { EXAMPLE_PROMPTS, generateImage, getAiCredits, getAiHistory, getStore, reportAiImage, saveAiImage, transformImage, validatePrompt, type AiOp } from "@/lib/api";
import type { AiAspect, AiGeneration, AiImage, AiPurpose, AiStyle, AiTextLayer, MediaItem, MediaRef } from "@/lib/types";
import { cn } from "@/lib/utils";

const PURPOSES: { value: AiPurpose; label: string; aspect: AiAspect }[] = [
  { value: "product_cover", label: "Product cover", aspect: "4:5" },
  { value: "hero_banner", label: "Hero banner", aspect: "16:9" },
  { value: "social_post", label: "Social post", aspect: "1:1" },
  { value: "collection_tile", label: "Collection tile", aspect: "1:1" },
];
const ASPECTS: AiAspect[] = ["1:1", "4:5", "16:9", "3:1"];
const STYLES: { value: AiStyle; label: string }[] = [
  { value: "clean", label: "Clean" },
  { value: "bold", label: "Bold" },
  { value: "playful", label: "Playful" },
  { value: "minimal", label: "Minimal" },
  { value: "photographic", label: "Photographic" },
  { value: "illustration", label: "Illustration" },
];
const ASPECT_CLASS: Record<AiAspect, string> = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video", "3:1": "aspect-[3/1]" };
const TEXT_COLORS = ["#FFFFFF", "#0C1F1B", "#C9A24F", "#0F3D33"];
const OP_LABEL: Record<AiImage["op"], string> = { generate: "Generated", regenerate: "Regenerated", vary: "Variation", edit: "Edited", remove_bg: "Background removed", replace_bg: "Background replaced", upscale: "Upscaled" };

function DownloadButton({ img, name }: { img: AiImage; name: string }) {
  const { url } = useMediaUrl(img.src);
  return (
    <Button asChild={!!url} variant="ghost" size="sm" disabled={!url}>
      {url ? (
        <a href={url} download={`${name.replace(/[^\w-]+/g, "-").slice(0, 40) || "image"}.png`}>
          <Download aria-hidden /> Download
        </a>
      ) : (
        <span>
          <Download aria-hidden /> Download
        </span>
      )}
    </Button>
  );
}

/**
 * The AI image maker (Part 6E). Describe, pick purpose, shape and style, generate four variations,
 * then use, regenerate, vary, edit, swap backgrounds, upscale, add text, download or report.
 * `onUse` is set when it's opened from an image field: "Use this image" sends the saved file back.
 */
export function AiImageMaker({ initialPurpose = "product_cover", onUse, compact }: { initialPurpose?: AiPurpose; onUse?: (m: MediaItem) => void; compact?: boolean }) {
  const plan = usePlan();
  const store = useApi(getStore, []);
  const creditsApi = useApi(getAiCredits, [], { live: true });
  const history = useApi(getAiHistory, [], { live: true });
  const [prompt, setPrompt] = useState("");
  const [purpose, setPurpose] = useState<AiPurpose>(initialPurpose);
  const [aspect, setAspect] = useState<AiAspect>(PURPOSES.find((p) => p.value === initialPurpose)!.aspect);
  const [style, setStyle] = useState<AiStyle>("clean");
  const [reference, setReference] = useState<MediaRef>();
  const [brand, setBrand] = useState(false);
  const [gen, setGen] = useState<AiGeneration>();
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [instruction, setInstruction] = useState("");
  const [text, setText] = useState<AiTextLayer | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const credits = creditsApi.data;
  const left = credits ? Math.max(0, credits.limit - credits.used) : undefined;
  const img = gen?.images.find((i) => i.id === selected && !i.reported);
  const brandColors = store.data ? [store.data.brandColor, "#C9A24F", "#F5F6F4"] : undefined;

  async function run(label: string, fn: (signal: AbortSignal) => Promise<AiGeneration>) {
    setError(undefined);
    abort.current = new AbortController();
    setBusy(label);
    try {
      const g = await fn(abort.current.signal);
      setGen(g);
      setSelected(g.images[0]?.id);
      creditsApi.reload();
      history.reload();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") toast("Cancelled. No credit used.");
      else if (!plan.handleLimitError(e)) setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
      abort.current = null;
    }
  }

  function generate() {
    const problem = validatePrompt(prompt);
    if (problem) {
      setError(problem);
      promptRef.current?.focus();
      return;
    }
    if (left === 0) return plan.upgrade("aiCredits");
    run("Creating 4 images", (signal) => generateImage({ prompt, purpose, aspect, style, reference: reference?.src, brandColors: brand ? brandColors : undefined }, { signal }));
  }

  function transform(op: AiOp, label: string) {
    if (!gen || !img) return;
    if (left === 0) return plan.upgrade("aiCredits");
    run(label, (signal) => transformImage(op, gen.id, img.id, { instruction, signal }));
  }

  async function use(alsoSend: boolean) {
    if (!gen || !img) return;
    setBusy(alsoSend ? "Adding the image" : "Saving to your library");
    try {
      const item = await saveAiImage(gen.id, img.id, { textLayer: text ?? undefined, alt: prompt || gen.request.prompt });
      if (alsoSend && onUse) {
        onUse(item);
        toast.success("Image added", { description: "It's in your media library too." });
      } else {
        toast.success("Saved to your media library");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the image.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6", !compact && "lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]")}>
      {/* Form */}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
        aria-busy={!!busy || undefined}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-prompt">Describe the image</Label>
          <Textarea ref={promptRef} id="ai-prompt" rows={4} maxLength={600} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A calm workspace with morning light, soft greens" aria-invalid={error === validatePrompt(prompt) && !!error ? true : undefined} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-purpose">What it&apos;s for</Label>
            <Select
              value={purpose}
              onValueChange={(v) => {
                setPurpose(v as AiPurpose);
                setAspect(PURPOSES.find((p) => p.value === v)!.aspect);
              }}
            >
              <SelectTrigger id="ai-purpose" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PURPOSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" aria-hidden>Shape</span>
            <Segmented label="Shape" value={aspect} onChange={setAspect} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
          </div>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">Style</legend>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button key={s.value} type="button" aria-pressed={style === s.value} onClick={() => setStyle(s.value)} className={cn("inline-flex min-h-9 items-center rounded-full border px-3 text-sm pointer-coarse:min-h-11", style === s.value ? "border-primary bg-primary-soft font-semibold text-primary" : "hover:border-border-strong")}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
        <MediaUploader compact label="Reference image (optional)" hint="A product screenshot or a look you like" kinds={["image"]} value={reference} onChange={setReference} withAlt={false} withFocal={false} />
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Use my store colours</span>
            {brandColors && (
              <span className="mt-1 flex gap-1" aria-hidden>
                {brandColors.map((c) => <span key={c} className="size-4 rounded-full border" style={{ background: c }} />)}
              </span>
            )}
          </span>
          <Switch checked={brand} onCheckedChange={setBrand} aria-label="Use my store colours" />
        </label>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={!!busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} Generate 4 images
          </Button>
          {credits && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              <span className="font-semibold text-foreground">{left} of {credits.limit} credits left this month.</span> Each generation or edit uses 1 credit; credits reset on the 1st.
              {plan.limits && plan.state?.tier !== "pro" && (
                <>
                  {" "}Pro includes {plan.limits.pro.aiCredits}.{" "}
                  <button type="button" className="inline-flex min-h-8 items-center font-semibold text-primary underline underline-offset-4 pointer-coarse:min-h-11" onClick={() => plan.upgrade("aiCredits")}>Upgrade</button>
                </>
              )}
            </p>
          )}
        </div>
        <p className="rounded-control bg-muted px-3 py-2 text-xs text-muted-foreground">
          Make your own pictures. Don&apos;t ask for real brands, logos or real people&apos;s faces; images that copy them can be removed.
        </p>
      </form>

      {/* Results */}
      <section aria-label="Results" className="flex min-w-0 flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium">
            {error}
          </p>
        )}

        {busy && busy !== "Saving to your library" && busy !== "Adding the image" ? (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{busy}… this takes a few seconds.</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => abort.current?.abort()}>
                <X aria-hidden /> Cancel
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn("animate-pulse rounded-media bg-gradient-to-br from-muted via-surface-sunken to-muted motion-reduce:animate-none", ASPECT_CLASS[aspect])} />
              ))}
            </div>
          </div>
        ) : !gen ? (
          <div className="flex flex-col gap-3 rounded-card border border-dashed p-5">
            <p className="font-display text-lg">Not sure where to start?</p>
            <p className="text-sm text-muted-foreground">Tap an idea to fill the box, then Generate.</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <li key={p}>
                  <button type="button" onClick={() => setPrompt(p)} className="flex min-h-11 w-full items-center rounded-control border bg-surface px-3 py-2 text-left text-sm hover:border-primary">
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Pick an image" className="grid grid-cols-2 gap-3">
              {gen.images.map((i, n) => (
                <button
                  key={i.id}
                  type="button"
                  role="radio"
                  aria-checked={selected === i.id}
                  aria-label={`Image ${n + 1} of ${gen.images.length}${i.reported ? ", reported" : ""}`}
                  disabled={i.reported}
                  onClick={() => setSelected(i.id)}
                  className={cn("@container relative overflow-hidden rounded-media border-2 bg-[repeating-conic-gradient(#e5e7e5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]", ASPECT_CLASS[gen.request.aspect], selected === i.id ? "border-primary ring-2 ring-primary" : "border-transparent", i.reported && "opacity-30")}
                >
                  <MediaImg src={i.src} alt="" decorative className="absolute inset-0" />
                  {selected === i.id && text?.text && <TextLayerPreview layer={text} />}
                  {selected === i.id && <Check className="absolute top-2 right-2 size-5 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden />}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {OP_LABEL[gen.images[0]?.op ?? "generate"]}
              {gen.images[0]?.instruction ? `: “${gen.images[0].instruction}”` : ""} · {gen.request.aspect} · {STYLES.find((s) => s.value === gen.request.style)?.label}
            </p>

            {img && (
              <div className="flex flex-col gap-4 rounded-card border bg-surface p-4">
                <div className="flex flex-wrap gap-2">
                  {onUse && (
                    <Button type="button" onClick={() => use(true)} disabled={!!busy}>
                      {busy === "Adding the image" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Use this image
                    </Button>
                  )}
                  <Button type="button" variant={onUse ? "secondary" : "primary"} onClick={() => use(false)} disabled={!!busy}>
                    {busy === "Saving to your library" ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} Save to library
                  </Button>
                  <DownloadButton img={img} name={gen.request.prompt} />
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Change this image">
                  <Button type="button" variant="secondary" size="sm" onClick={() => transform("regenerate", "Regenerating")} disabled={!!busy}><RefreshCw aria-hidden /> Regenerate</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => transform("vary", "Making 4 more like this")} disabled={!!busy}><Shuffle aria-hidden /> More like this</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => transform("remove_bg", "Removing the background")} disabled={!!busy}><Eraser aria-hidden /> Remove background</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => transform("replace_bg", "Replacing the background")} disabled={!!busy}><Paintbrush aria-hidden /> Replace background</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => transform("upscale", "Upscaling")} disabled={!!busy}><Maximize2 aria-hidden /> Upscale</Button>
                </div>
                <form
                  className="flex flex-col gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    transform("edit", "Editing");
                  }}
                >
                  <Label htmlFor="ai-edit">Edit by instruction</Label>
                  <div className="flex gap-2">
                    <Input id="ai-edit" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Make the background darker" />
                    <Button type="submit" variant="secondary" disabled={!!busy}><Wand2 aria-hidden /> Apply</Button>
                  </div>
                </form>
                <TextLayerEditor layer={text} onChange={setText} />
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1.5 self-start text-xs text-muted-foreground underline-offset-4 hover:underline pointer-coarse:min-h-11"
                  onClick={async () => {
                    await reportAiImage(gen.id, img.id);
                    setGen({ ...gen, images: gen.images.map((x) => (x.id === img.id ? { ...x, reported: true } : x)) });
                    setSelected(gen.images.find((x) => x.id !== img.id && !x.reported)?.id);
                    toast("Thanks for reporting", { description: "We've hidden it and will review it." });
                  }}
                >
                  <Flag className="size-3.5" aria-hidden /> Report image
                </button>
              </div>
            )}
          </>
        )}

        {/* History */}
        <div className="flex flex-col gap-2">
          <Button type="button" variant="ghost" size="sm" className="self-start" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>
            <History aria-hidden /> History ({history.data?.length ?? 0})
          </Button>
          {showHistory && (
            history.data?.length ? (
              <ul className="flex flex-col gap-2" aria-label="Past images">
                {history.data.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setGen(h);
                        setSelected(h.images.find((x) => !x.reported)?.id);
                        setPrompt(h.request.prompt);
                      }}
                      className={cn("flex min-h-14 w-full items-center gap-3 rounded-control border bg-surface p-2 text-left hover:border-border-strong", gen?.id === h.id && "border-primary")}
                    >
                      <span className="flex shrink-0 gap-1">
                        {h.images.slice(0, 4).map((i) => (
                          <span key={i.id} className="relative block size-10 overflow-hidden rounded-[6px] bg-muted"><MediaImg src={i.src} alt="" decorative className="absolute inset-0" /></span>
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{h.request.prompt}</span>
                        <span className="text-xs text-muted-foreground">{OP_LABEL[h.images[0]?.op ?? "generate"]} · {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing yet. Your images appear here.</p>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function TextLayerPreview({ layer }: { layer: AiTextLayer }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-center whitespace-pre-line", layer.font === "display" ? "font-display font-extrabold" : "font-sans font-semibold", layer.size === "sm" ? "text-[6cqw]" : layer.size === "md" ? "text-[9cqw]" : "text-[13cqw]")}
      style={{ left: `${layer.x}%`, top: `${layer.y}%`, color: layer.color, lineHeight: 1.1 }}
    >
      {layer.text}
    </span>
  );
}

/** Words on the picture stay a separate, editable layer until the image is used or saved. */
function TextLayerEditor({ layer, onChange }: { layer: AiTextLayer | null; onChange: (l: AiTextLayer | null) => void }) {
  if (!layer) {
    return (
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onChange({ text: "Your title", x: 50, y: 80, size: "md", color: "#FFFFFF", font: "display" })}>
        <Type aria-hidden /> Add text
      </Button>
    );
  }
  return (
    <fieldset className="flex flex-col gap-3 rounded-control border p-3">
      <legend className="px-1 text-sm font-medium">Text on the image</legend>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-text">Words</Label>
        <Textarea id="ai-text" rows={2} maxLength={80} value={layer.text} onChange={(e) => onChange({ ...layer, text: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Text size" value={layer.size} onChange={(size) => onChange({ ...layer, size })} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} />
        <Segmented label="Font" value={layer.font} onChange={(font) => onChange({ ...layer, font })} options={[{ value: "display", label: "Heading" }, { value: "body", label: "Body" }]} />
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Text colour">
        {TEXT_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={layer.color === c} aria-label={c} onClick={() => onChange({ ...layer, color: c })} className={cn("size-8 rounded-full border-2 pointer-coarse:size-11", layer.color === c ? "border-foreground ring-2 ring-primary ring-offset-2" : "border-border")} style={{ background: c }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["x", "y"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <Label htmlFor={`ai-text-${k}`} className="text-xs">{k === "x" ? "Across" : "Down"}</Label>
            <input id={`ai-text-${k}`} type="range" min={5} max={95} value={layer[k]} onChange={(e) => onChange({ ...layer, [k]: Number(e.target.value) })} className="h-11 accent-[var(--primary)]" />
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" className="self-start text-danger" onClick={() => onChange(null)}>
        <X aria-hidden /> Remove text
      </Button>
    </fieldset>
  );
}
