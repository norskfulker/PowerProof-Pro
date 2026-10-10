"use client";

import { createContext, Fragment, useContext, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ImageOff, Play, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BundleBox } from "@/components/pp/bundle-box";
import { CollectionTile } from "@/components/pp/collection-tile";
import { HighlightsStrip, autoHighlights, type HighlightView } from "@/components/pp/highlights-strip";
import { StoreIcon, type IconWeight } from "@/components/pp/icon-library";
import { Marquee } from "@/components/pp/marquee";
import { HtmlSection } from "@/components/storefront/html-section";
import { PALETTES, schemeClass, schemeVars } from "@/lib/store-themes";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { NewsletterForm } from "@/components/pp/newsletter-form";
import { CoverArt, ImagePlaceholder } from "@/components/pp/product-cover";
import { ScrollRegion } from "@/components/pp/scroll-region";
import { StoreProductCard } from "@/components/pp/store-product-card";
import type { LeadInput, RenderContext } from "@/lib/api";
import { BookingBlock, LeadFormBlock } from "./lead-blocks";
import { contrast, liftTo, mixHex, readableOn } from "@/lib/color";
import { paragraphs, parseInline } from "@/lib/pages/rich-text";
import { type Background, type BlockProps, type BlockStyle, type PageDoc, type PageNode } from "@/lib/pages/schema";
import type { CurrencyCode } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The one renderer for store pages: the editor canvas and the public page both use it, so what
 * the creator sees is what buyers get. Layout responds to the page's own width through container
 * queries (`@container/page`), which is how the editor's phone/tablet/desktop switch works.
 */

export interface RenderEnv {
  mode: "edit" | "live";
  currency: CurrencyCode;
  onBuy?: (productId: string) => void;
  onBuyBundle?: (bundleId: string) => void;
  buying?: string;
  onSubscribe?: (email: string) => Promise<void>;
  /** Lead forms and bookings (live pages) */
  onLead?: (input: LeadInput) => Promise<void>;
  loadBooked?: (from: Date, to: Date) => Promise<{ at: Date; minutes: number }[]>;
  /** Editor only */
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Editor only: text typed straight into the page. `path` is a prop, or a path into one ("rows.1.2"). */
  onText?: (id: string, path: string, value: string) => void;
  /** Editor only: an icon on the page was clicked; open the picker for it */
  onIcon?: (id: string, path: string, current: string) => void;
  /** Editor only: drawn before each top-level section (index) and after the last (blocks.length) */
  between?: (index: number) => React.ReactNode;
}

const Env = createContext<RenderEnv>({ mode: "live", currency: "INR" });
const Ctx = createContext<RenderContext | null>(null);
const useRenderContext = () => useContext(Ctx)!;
/** Product ids that have a card on this page, so "scroll to product" buttons can jump to them */
const Anchors = createContext<Set<string>>(new Set());


/* ------------------------------------------------------------------ */
/* Scales                                                               */
/* ------------------------------------------------------------------ */

// Spacing, width and heading size scale with the site's layout (--pp-space, --pp-measure, --pp-display; lib/site-styles.ts)
const PAD = {
  none: "py-0",
  sm: "py-[calc(1.5rem*var(--pp-space,1))]",
  md: "py-[calc(2.5rem*var(--pp-space,1))] @3xl/page:py-[calc(3.5rem*var(--pp-space,1))]",
  lg: "py-[calc(3.5rem*var(--pp-space,1))] @3xl/page:py-[calc(5rem*var(--pp-space,1))]",
  xl: "py-[calc(5rem*var(--pp-space,1))] @3xl/page:py-[calc(7rem*var(--pp-space,1))]",
} as const;
const WIDTH = { narrow: "max-w-[calc(42rem*var(--pp-measure,1))]", normal: "max-w-[calc(56rem*var(--pp-measure,1))]", wide: "max-w-[calc(72rem*var(--pp-measure,1))]", full: "max-w-none" } as const;
const MIN_H = { auto: "", sm: "min-h-64", md: "min-h-96", lg: "min-h-[36rem]", screen: "min-h-[var(--pp-screen,100svh)]" } as const;
const GAP = { sm: "gap-3", md: "gap-5", lg: "gap-8" } as const;
const HEADING = {
  sm: "text-[length:calc(1.25rem*var(--pp-display,1))] @3xl/page:text-[length:calc(1.5rem*var(--pp-display,1))]",
  md: "text-[length:calc(1.5rem*var(--pp-display,1))] @3xl/page:text-[length:calc(1.875rem*var(--pp-display,1))]",
  lg: "text-[length:calc(clamp(1.75rem,6cqw,2.75rem)*var(--pp-display,1))]",
  xl: "text-[length:calc(clamp(2.25rem,8cqw,4rem)*var(--pp-display,1))]",
} as const;
const TEXT = { sm: "text-sm", md: "text-base", lg: "text-lg" } as const;
const ASPECT = { auto: "", "1:1": "aspect-square", "4:3": "aspect-[4/3]", "16:9": "aspect-video", "3:4": "aspect-[3/4]" } as const;
const SPACER = { sm: "h-4", md: "h-8", lg: "h-16", xl: "h-24" } as const;
const RADIUS = { none: "", sm: "rounded-control", md: "rounded-card", lg: "rounded-dialog" } as const;
const BUTTON_SIZE = { sm: "min-h-9 px-4 text-sm pointer-coarse:min-h-11", md: "min-h-11 px-5 text-sm", lg: "min-h-13 px-7 text-base" } as const;

/** Radius, border and shadow from the token scale */
function boxClass(style: BlockStyle) {
  return cn(RADIUS[style.radius], style.radius !== "none" && "overflow-hidden", style.border && "border border-current/15", style.shadow === "soft" && "shadow-pop");
}

const LIGHT = "#F5F6F4";
const DARK = "#0C1F1B";

/** Which text tone reads on a background. Images need an overlay we can count on. */
export function autoTone(style: BlockStyle): "light" | "dark" | undefined {
  const bg = style.background;
  if (bg.kind === "solid") return contrast(LIGHT, bg.color) >= contrast(DARK, bg.color) ? "light" : "dark";
  if (bg.kind === "gradient") {
    const light = Math.min(contrast(LIGHT, bg.from), contrast(LIGHT, bg.to));
    const dark = Math.min(contrast(DARK, bg.from), contrast(DARK, bg.to));
    return light >= dark ? "light" : "dark";
  }
  if (bg.kind === "image" || bg.kind === "gif" || bg.kind === "video") return "light";
  return undefined;
}

/** A plain-words warning when text may be hard to read on this background, else undefined. */
export function contrastWarning(style: BlockStyle): string | undefined {
  const bg = style.background;
  const tone = style.tone === "auto" ? autoTone(style) : style.tone;
  if (!tone) return undefined;
  const ink = tone === "light" ? LIGHT : DARK;
  if (bg.kind === "solid" && contrast(ink, bg.color) < 4.5) return `Text may be hard to read: contrast is ${contrast(ink, bg.color).toFixed(1)}:1, aim for 4.5:1. Try ${tone === "light" ? "dark" : "light"} text or another colour.`;
  if (bg.kind === "gradient") {
    const worst = Math.min(contrast(ink, bg.from), contrast(ink, bg.to));
    if (worst < 4.5) return `Text may be hard to read on part of this gradient (${worst.toFixed(1)}:1). Pick closer colours or switch the text colour.`;
  }
  if ((bg.kind === "image" || bg.kind === "gif" || bg.kind === "video") && style.overlay < 0.35) return "Text over a photo or video needs a darker overlay to stay readable. Set the overlay to at least 35%.";
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Media                                                                */
/* ------------------------------------------------------------------ */

function useMedia(src: string): { url?: string; missing: boolean } {
  return { url: src.startsWith("https://") ? src : undefined, missing: !!src && !src.startsWith("https://") };
}

function MediaImage({ src, alt, className, fit = "cover", focal, decorative }: { src: string; alt: string; className?: string; fit?: "cover" | "contain"; focal?: { x: number; y: number }; decorative?: boolean }) {
  const ctx = useRenderContext();
  const media = useMedia(src.startsWith("product:") ? "" : src);
  if (src.startsWith("product:")) {
    const p = ctx.products.find((x) => x.id === src.slice(8));
    const img = p?.images[0];
    // An uploaded product photo shows as itself; a generated cover is drawn
    if (img?.src) return <MediaImage src={img.src} alt={alt || p?.title || ""} className={className} fit={fit} focal={img.focal ?? focal} decorative={decorative} />;
    const cover = img?.cover;
    return cover ? <CoverArt cover={cover} label={decorative ? undefined : alt || p?.title} className={className} size="md" /> : <ImagePlaceholder className={className} />;
  }
  if (!src || media.missing) {
    return (
      <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : media.missing ? "Image not available" : "No image"} aria-hidden={decorative || undefined}>
        <ImageOff className="size-6" aria-hidden />
      </div>
    );
  }
  if (!media.url) return <div className={cn("animate-pulse bg-muted", className)} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.url} alt={decorative ? "" : alt} loading="lazy" className={cn("dim-media h-full w-full", fit === "cover" ? "object-cover" : "object-contain", className)} style={focal ? { objectPosition: `${focal.x}% ${focal.y}%` } : undefined} />;
}

function BackgroundLayer({ bg, overlay, overlayColor }: { bg: Background; overlay: number; overlayColor: string }) {
  const video = useMedia(bg.kind === "video" ? bg.src : "");
  if (bg.kind === "none" || bg.kind === "solid" || bg.kind === "gradient") return null;
  const focal = `${bg.focal.x}% ${bg.focal.y}%`;
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {bg.kind === "video" ? (
        <>
          {/* Poster on phones and with reduced motion; the video only plays on wider screens */}
          <MediaImage src={bg.poster} alt="" decorative focal={bg.focal} className="absolute inset-0" />
          {video.url && <video src={video.url} poster={undefined} autoPlay muted loop playsInline className="dim-media absolute inset-0 hidden h-full w-full object-cover motion-safe:@3xl/page:block" style={{ objectPosition: focal }} />}
        </>
      ) : (
        <MediaImage src={bg.src} alt="" decorative focal={bg.focal} className="absolute inset-0 rounded-none" />
      )}
      {overlay > 0 && <div className="absolute inset-0" style={{ background: overlayColor, opacity: overlay }} />}
    </div>
  );
}

function pageInk(style: BlockStyle): string | undefined {
  const tone = style.tone === "auto" ? autoTone(style) : style.tone;
  return tone === "light" ? LIGHT : tone === "dark" ? DARK : undefined;
}

function backgroundCss(bg: Background): React.CSSProperties | undefined {
  if (bg.kind === "solid") return { background: bg.color };
  if (bg.kind === "gradient") return { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` };
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Node wrapper                                                         */
/* ------------------------------------------------------------------ */

function visibilityClass(v: { mobile: boolean; desktop: boolean }, mode: RenderEnv["mode"]) {
  // In the editor hidden blocks stay visible but faded, so they can still be selected
  if (mode === "edit") return !v.mobile || !v.desktop ? cn(!v.mobile && "@max-3xl/page:opacity-40", !v.desktop && "@3xl/page:opacity-40") : "";
  return cn(!v.mobile && "@max-3xl/page:hidden", !v.desktop && "@3xl/page:hidden");
}

/** A content block's own alignment, over the section's */
const SELF_ALIGN = { "": "", left: "text-left [&_figure]:items-start", center: "text-center [&_figure]:items-center", right: "text-right [&_figure]:items-end" } as const;

function Frame({ node, className, children, as: Tag = "div", style, bare }: { node: PageNode; className?: string; children: React.ReactNode; as?: "div" | "section"; style?: React.CSSProperties; /** Colours and box are drawn by an inner panel instead */ bare?: boolean }) {
  const env = useContext(Env);
  const selected = env.mode === "edit" && env.selectedId === node.id;
  const top = node.type === "section" || node.type === "hero";
  return (
    <Tag
      // Sections keep "#section-<id>" anchors so buttons can jump to them
      id={top ? `section-${node.id}` : undefined}
      data-node-id={env.mode === "edit" ? node.id : undefined}
      data-node-type={env.mode === "edit" ? node.type : undefined}
      className={cn(
        !bare && schemeClass(node.style.scheme),
        // A content block with its own scheme reads as a small panel
        !bare && !top && node.style.scheme && !["columns", "column", "cards", "card"].includes(node.type) && "rounded-card p-4",
        top && "scroll-mt-20",
        SELF_ALIGN[node.style.selfAlign ?? ""],
        visibilityClass(node.visibility, env.mode),
        !bare && boxClass(node.style),
        env.mode === "edit" && "relative outline-offset-2 hover:outline hover:outline-1 hover:outline-primary/50",
        selected && "outline outline-2 outline-primary hover:outline-2 hover:outline-primary",
        className
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Typing on the page (editor only)                                     */
/* ------------------------------------------------------------------ */

type TextTag = "span" | "p" | "h1" | "h2" | "h3" | "blockquote" | "figcaption" | "div";

/**
 * Text that can be typed into on the editor's canvas; on the live page it is just the text.
 * Plain text only (pasting drops formatting). Enter ends single-line text.
 */
function T({ node, path, value, as = "span", className, multiline, placeholder = "Type here", optional }: { node: PageNode; path: string; value: string; as?: TextTag; className?: string; multiline?: boolean; placeholder?: string; /** Empty text only shows (as a placeholder) while its block is selected */ optional?: boolean }) {
  const env = useContext(Env);
  const ref = useRef<HTMLElement>(null);
  const Tag = as as "span";
  const editing = env.mode === "edit" && !!env.onText;
  useLayoutEffect(() => {
    const el = ref.current;
    // Don't overwrite what is being typed
    if (el && editing && el.ownerDocument.activeElement !== el && el.innerText !== value) el.innerText = value;
  });
  if (!editing || (optional && !value && env.selectedId !== node.id)) return value ? <Tag className={className}>{value}</Tag> : null;
  return (
    <Tag
      ref={ref}
      className={cn(className, "pp-editable")}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline || undefined}
      aria-label={placeholder}
      data-placeholder={placeholder}
      onInput={(e) => env.onText?.(node.id, path, (e.currentTarget as HTMLElement).innerText)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        // Keep Delete, Backspace and arrows for the text, not the editor's shortcuts
        e.stopPropagation();
      }}
    />
  );
}

/** Rich text: shows formatted, and turns into its plain source (**bold**, _italic_, [links](…)) while typing */
function EditableRich({ node, value, className }: { node: PageNode; value: string; className?: string }) {
  const env = useContext(Env);
  const [typing, setTyping] = useState(false);
  const shown = paragraphs(value || (env.mode === "edit" ? "Write something…" : "")).map((para, i) => (
    <p key={i} className="whitespace-pre-line">
      <RichText text={para} />
    </p>
  ));
  if (env.mode !== "edit" || !env.onText) return <div className={className}>{shown}</div>;
  if (!typing) {
    return (
      <div className={cn(className, "pp-editable cursor-text")} tabIndex={0} role="button" aria-label="Edit text" onFocus={() => setTyping(true)}>
        {shown}
      </div>
    );
  }
  return <RichSource node={node} value={value} className={className} onDone={() => setTyping(false)} />;
}

function RichSource({ node, value, className, onDone }: { node: PageNode; value: string; className?: string; onDone: () => void }) {
  const env = useContext(Env);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerText = value;
    el.focus();
    // Caret at the end
    const r = el.ownerDocument.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const sel = el.ownerDocument.defaultView?.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
    // Only on first show: afterwards the text is what's typed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      className={cn(className, "pp-editable whitespace-pre-wrap")}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      aria-label="Text. **bold**, _italic_ and [link](https://…) work."
      onInput={(e) => env.onText?.(node.id, "text", (e.currentTarget as HTMLElement).innerText)}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
        e.stopPropagation();
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Blocks                                                               */
/* ------------------------------------------------------------------ */

function Stack({ nodes, gap, align }: { nodes: PageNode[]; gap: keyof typeof GAP; align: BlockStyle["align"] }) {
  return (
    <div className={cn("flex min-w-0 flex-col", GAP[gap], align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-stretch text-left")}>
      {nodes.map((n) => (
        <Block key={n.id} node={n} />
      ))}
    </div>
  );
}

/**
 * Colour correction: a section's own background (colour, gradient, picture or video) sets the
 * tokens everything inside reads (text, muted text, cards, borders, buttons), so cards, forms and
 * buttons stay readable on it without any per-block colours.
 */
function backgroundTokens(style: BlockStyle, brand: string): React.CSSProperties | undefined {
  const bg = style.background;
  const tone = style.tone === "auto" ? autoTone(style) : style.tone;
  let base: string | undefined;
  if (bg.kind === "solid") base = bg.color;
  else if (bg.kind === "gradient") base = mixHex(bg.from, bg.to, 0.5);
  else if (bg.kind === "image" || bg.kind === "gif" || bg.kind === "video") base = mixHex(style.overlayColor, tone === "dark" ? "#FFFFFF" : "#000000", 1 - Math.max(style.overlay, 0.35));
  if (!base) return undefined;
  const text = tone === "light" ? LIGHT : tone === "dark" ? DARK : readableOn(base);
  const button = liftTo(brand, base, 3);
  const { background: _bg, ...vars } = schemeVars({ background: base, text, button, buttonText: readableOn(button), border: mixHex(base, text, 0.2) });
  void _bg;
  return vars as React.CSSProperties;
}

/** The store's main colour, for buttons on a section's own background */
function useBrand(): string {
  const { theme } = useRenderContext();
  if (theme.brand && /^#[0-9a-f]{6}$/i.test(theme.brand)) return theme.brand;
  return (PALETTES.find((p) => p.id === theme.palette) ?? PALETTES[0]).primary;
}

/**
 * A section's colours and background. With "Content area" they sit on a rounded panel inside the
 * content width, so the band across the page keeps the page's own colour.
 */
function Painted({ node, outerClass, innerClass, children }: { node: PageNode; outerClass: string; innerClass: string; children: React.ReactNode }) {
  const brand = useBrand();
  const s = node.style;
  const painted = s.background.kind !== "none" || !!s.scheme;
  const panel = node.layout.fill === "content" && painted;
  const paint = { ...backgroundCss(s.background), ...backgroundTokens(s, brand) };
  const layer = <BackgroundLayer bg={s.background} overlay={s.overlay} overlayColor={s.overlayColor} />;
  if (!panel) {
    return (
      <Frame node={node} as="section" className={cn("relative isolate flex flex-col justify-center px-4 @3xl/page:px-8", PAD[node.layout.paddingY], MIN_H[node.layout.minHeight], outerClass)} style={paint}>
        {layer}
        <div className={cn("mx-auto w-full", WIDTH[node.layout.width], innerClass)}>{children}</div>
      </Frame>
    );
  }
  return (
    <Frame node={node} bare as="section" className={cn("relative flex flex-col justify-center px-4 @3xl/page:px-8", PAD[node.layout.paddingY === "none" ? "none" : "sm"], outerClass)}>
      <div
        className={cn("relative isolate mx-auto flex w-full flex-col justify-center overflow-hidden rounded-card px-5 @3xl/page:px-10", WIDTH[node.layout.width === "full" ? "wide" : node.layout.width], PAD[node.layout.paddingY], MIN_H[node.layout.minHeight], schemeClass(s.scheme), s.border && "border border-current/15", s.shadow === "soft" && "shadow-pop")}
        style={paint}
      >
        {layer}
        <div className={cn("w-full", innerClass)}>{children}</div>
      </div>
    </Frame>
  );
}

function SectionBlock({ node }: { node: PageNode }) {
  return (
    <Painted node={node} outerClass="" innerClass="">
      <Stack nodes={node.children} gap={node.layout.gap} align={node.style.align} />
    </Painted>
  );
}

/** The first hero on a page is its main heading */
const FirstHero = createContext<string | undefined>(undefined);

function HeroBlock({ node }: { node: PageNode<"hero"> }) {
  const p = node.props;
  const tone = node.style.tone === "auto" ? autoTone(node.style) : node.style.tone;
  const split = p.layout === "split";
  const centered = p.layout === "centered" || node.style.align === "center";
  const H = useContext(FirstHero) === node.id ? "h1" : "h2";
  const more = (p.moreImages ?? []).filter(Boolean);
  return (
    <Painted node={node} outerClass="" innerClass={cn("grid items-center gap-8", split && p.image ? "grid-cols-1 @3xl/page:grid-cols-2" : "grid-cols-1")}>
        <div className={cn("flex min-w-0 flex-col gap-4", centered ? "items-center text-center" : node.style.align === "right" ? "items-end text-right" : "items-start text-left")}>
          <T node={node} path="eyebrow" value={p.eyebrow} optional as="p" placeholder="Small line above" className="text-sm font-semibold tracking-wide uppercase opacity-80" />
          <T node={node} path="headline" value={p.headline} as={H} placeholder="Headline" className="font-display text-[length:calc(clamp(2rem,7cqw,3.75rem)*var(--pp-display,1))] leading-[1.02] font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere]" />
          <T node={node} path="subtext" value={p.subtext} optional as="p" multiline placeholder="A line under the headline" className="max-w-xl text-lg opacity-90 [overflow-wrap:anywhere]" />
          {(p.ctaLabel || p.cta2Label) && (
            <div className={cn("flex flex-wrap gap-3", centered ? "justify-center" : node.style.align === "right" && "justify-end")}>
              {p.ctaLabel && <LinkButton href={p.ctaHref} label={<T node={node} path="ctaLabel" value={p.ctaLabel} placeholder="Button" />} variant={tone === "light" ? "brass" : "primary"} size="lg" />}
              {p.cta2Label && <LinkButton href={p.cta2Href} label={<T node={node} path="cta2Label" value={p.cta2Label} placeholder="Button" />} variant="secondary" size="lg" />}
            </div>
          )}
        </div>
        {split && p.image && (more.length ? (
          <div className="grid grid-cols-2 gap-3">
            <MediaImage src={p.image} alt={p.imageAlt} className="col-span-2 aspect-[16/10] w-full rounded-card" />
            {more.map((src, i) => <MediaImage key={i} src={src} alt="" decorative className="aspect-[4/3] w-full rounded-card" />)}
          </div>
        ) : (
          <MediaImage src={p.image} alt={p.imageAlt} className="aspect-[4/3] w-full rounded-card" />
        ))}
    </Painted>
  );
}

function LinkButton({ href, label, variant, size = "md" }: { href: string; label: React.ReactNode; variant: "primary" | "secondary" | "brass"; size?: keyof typeof BUTTON_SIZE }) {
  const env = useContext(Env);
  const cls = cn(
    "inline-flex max-w-full items-center justify-center rounded-control font-semibold [overflow-wrap:anywhere] transition-colors",
    BUTTON_SIZE[size],
    variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary-hover",
    variant === "secondary" && "border border-current/30 bg-transparent hover:bg-current/5",
    variant === "brass" && "bg-accent text-accent-foreground hover:bg-accent-strong"
  );
  if (env.mode === "edit" || !href) return <span className={cls}>{label}</span>;
  if (href.startsWith("/") || href.startsWith("#")) return <Link href={href} className={cls}>{label}</Link>;
  return (
    <a href={href} className={cls} rel="noopener noreferrer" target={href.startsWith("mailto:") ? undefined : "_blank"}>
      {label}
    </a>
  );
}

/** A text link to a store path, an #anchor or another site */
function TextLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const env = useContext(Env);
  if (env.mode === "edit" || !href) return <span className={className}>{children}</span>;
  if (href.startsWith("/") || href.startsWith("#")) return <Link href={href} className={className}>{children}</Link>;
  return <a href={href} className={className} rel="noopener noreferrer" target={href.startsWith("mailto:") ? undefined : "_blank"}>{children}</a>;
}

function ProductCardBlock({ productId, showBuy }: { productId: string; showBuy: boolean }) {
  const ctx = useRenderContext();
  const env = useContext(Env);
  const p = ctx.products.find((x) => x.id === productId);
  if (!p) return <p className="rounded-card border border-dashed p-6 text-center text-sm opacity-70">Pick a product for this card.</p>;
  return (
    <div id={`p-${p.id}`} className="w-full max-w-sm scroll-mt-24 text-foreground">
      <StoreProductCard product={p} href={`/s/${ctx.store.slug}/${p.slug}`} currency={env.currency} onBuy={showBuy ? () => env.onBuy?.(p.id) : undefined} buying={env.buying === p.id} />
    </div>
  );
}

function ProductGridBlock({ props }: { props: BlockProps<"product_grid"> }) {
  const ctx = useRenderContext();
  const env = useContext(Env);
  let list = ctx.products;
  if (props.source === "manual") list = props.productIds.map((id) => ctx.products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  if (props.source === "collection") {
    const c = ctx.collections.find((x) => x.slug === props.collectionSlug);
    list = c ? c.productIds.map((id) => ctx.products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p) : [];
  }
  const sort = props.sort ?? "featured";
  if (sort === "popular") list = [...list].sort((a, b) => b.salesCount - a.salesCount);
  if (sort === "newest") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === "price-asc") list = [...list].sort((a, b) => a.info.price.amount - b.info.price.amount);
  if (sort === "price-desc") list = [...list].sort((a, b) => b.info.price.amount - a.info.price.amount);
  list = list.slice(0, props.limit);
  if (!list.length) return <p className="rounded-card border border-dashed p-6 text-center text-sm opacity-70">No products to show yet.</p>;
  return (
    <ul className={cn("grid w-full grid-cols-1 gap-4 text-left text-foreground @md/page:grid-cols-2", props.columns >= 3 && "@3xl/page:grid-cols-3", props.columns === 4 && "@5xl/page:grid-cols-4")}>
      {list.map((p) => (
        <li key={p.id} className="min-w-0">
          <StoreProductCard product={p} href={`/s/${ctx.store.slug}/${p.slug}`} currency={env.currency} onBuy={() => env.onBuy?.(p.id)} buying={env.buying === p.id} />
        </li>
      ))}
    </ul>
  );
}

function TestimonialsBlock({ props }: { props: BlockProps<"testimonials"> }) {
  const ctx = useRenderContext();
  const items = props.source === "reviews" ? ctx.reviews.slice(0, props.limit).map((r) => ({ quote: r.body || r.title, author: r.author, rating: r.rating })) : props.items.map((i) => ({ ...i, rating: 5 }));
  if (!items.length) return <p className="rounded-card border border-dashed p-6 text-center text-sm opacity-70">Reviews show here once buyers leave some.</p>;
  return (
    <ul className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4 text-left">
      {items.map((t, i) => (
        <li key={i} className="flex flex-col gap-3 rounded-card border border-current/15 bg-current/[0.03] p-5">
          <span className="flex gap-0.5" role="img" aria-label={`${t.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, s) => (
              <Star key={s} className={cn("size-4", s < t.rating ? "fill-accent text-accent" : "opacity-30")} aria-hidden />
            ))}
          </span>
          <blockquote className="text-base [overflow-wrap:anywhere]">“{t.quote}”</blockquote>
          <p className="text-sm font-semibold opacity-80">{t.author}</p>
        </li>
      ))}
    </ul>
  );
}

/** YouTube and Vimeo links become a privacy-friendly embed; anything else stays a plain link */
export function embedUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (u.protocol !== "https:") return undefined;
    if (host === "youtu.be") return /^[\w-]{6,}$/.test(u.pathname.slice(1)) ? `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` : undefined;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : u.pathname.startsWith("/shorts/") ? u.pathname.slice(8) : undefined);
      return v && /^[\w-]{6,}$/.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : undefined;
    }
    if (host === "vimeo.com") return /^\d+$/.test(u.pathname.slice(1)) ? `https://player.vimeo.com/video/${u.pathname.slice(1)}` : undefined;
  } catch {
    return undefined;
  }
  return undefined;
}

const VIDEO_ASPECT = { "16:9": "aspect-video", "4:3": "aspect-[4/3]", "1:1": "aspect-square", "9:16": "aspect-[9/16] max-w-sm mx-auto" } as const;

function VideoBlock({ node, props }: { node: PageNode; props: BlockProps<"video"> }) {
  const env = useContext(Env);
  const media = useMedia(props.src);
  const poster = useMedia(props.poster);
  const file = /^asset:/.test(props.src) || /\.(mp4|webm|mov)(\?|$)/i.test(props.src) || (props.src.startsWith("https://") && /\/storage\/v1\/object\//.test(props.src));
  const embed = !file && props.src ? embedUrl(props.src) : undefined;
  const box = cn("w-full overflow-hidden rounded-card bg-black", VIDEO_ASPECT[props.aspect ?? "16:9"]);
  return (
    <figure className="flex w-full flex-col gap-2">
      {!props.src ? (
        <div className={cn(box, "grid place-items-center bg-muted text-muted-foreground")} role="img" aria-label="No video yet">
          <Play className="size-8" aria-hidden />
        </div>
      ) : embed ? (
        <div className={cn(box, "relative")}>
          <iframe src={`${embed}${props.autoplay ? (embed.includes("vimeo") ? "?autoplay=1&muted=1&loop=1" : "?autoplay=1&mute=1") : ""}`} title={props.caption || "Video"} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
          {/* In the editor a click selects the block instead of starting the player */}
          {env.mode === "edit" && <div className="absolute inset-0" aria-hidden />}
        </div>
      ) : !file ? (
        <a href={props.src} target="_blank" rel="noopener noreferrer" className={cn(box, "grid place-items-center text-white")}>
          <span className="inline-flex items-center gap-2 font-semibold"><Play className="size-6" aria-hidden /> Watch the video</span>
        </a>
      ) : props.autoplay ? (
        <video src={media.url} poster={poster.url} autoPlay muted loop playsInline controls className={cn(box, "object-cover")} aria-label={props.caption || "Video"} />
      ) : (
        <video src={media.url} poster={poster.url} controls preload="metadata" playsInline className={cn(box, "object-contain")} />
      )}
      <T node={node} path="caption" value={props.caption} as="figcaption" optional placeholder="Caption" className="text-sm opacity-80" />
    </figure>
  );
}

function Block({ node }: { node: PageNode }) {
  const env = useContext(Env);
  switch (node.type) {
    case "section":
      return <SectionBlock node={node} />;
    case "hero":
      return <HeroBlock node={node as PageNode<"hero">} />;
    case "columns": {
      const p = node.props as BlockProps<"columns">;
      const n = node.children.length;
      const tpl = p.ratio === "2:1" ? "@3xl/page:grid-cols-[2fr_1fr]" : p.ratio === "1:2" ? "@3xl/page:grid-cols-[1fr_2fr]" : n === 2 ? "@3xl/page:grid-cols-2" : n === 3 ? "@3xl/page:grid-cols-3" : "@3xl/page:grid-cols-4";
      return (
        <Frame node={node} className={cn("grid w-full", p.valign === "center" ? "items-center" : p.valign === "end" ? "items-end" : "items-start", GAP[node.layout.gap], p.stackOnMobile ? cn("grid-cols-1", tpl) : n === 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-4")}>
          {node.children.map((c) => (
            <Block key={c.id} node={c} />
          ))}
        </Frame>
      );
    }
    case "column":
      return (
        <Frame node={node} className="min-w-0">
          <Stack nodes={node.children} gap={node.layout.gap} align={node.style.align} />
        </Frame>
      );
    case "heading": {
      const p = node.props as BlockProps<"heading">;
      const H = (`h${p.level}` as "h1" | "h2" | "h3");
      const title = <T node={node} path="text" value={p.text} as={H} placeholder="Heading" className={cn("font-display leading-[1.08] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]", HEADING[p.size])} />;
      if (!p.linkLabel) return <Frame node={node}>{title}</Frame>;
      return (
        <Frame node={node} className="flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-1 text-left">
          {title}
          <TextLink href={p.linkHref} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <T node={node} path="linkLabel" value={p.linkLabel} placeholder="Link" /> <ArrowRight className="size-4" aria-hidden />
          </TextLink>
        </Frame>
      );
    }
    case "text": {
      const p = node.props as BlockProps<"text">;
      return (
        <Frame node={node} className="max-w-prose [overflow-wrap:anywhere]">
          <EditableRich node={node} value={p.text} className={cn("flex flex-col gap-3", TEXT[p.size])} />
        </Frame>
      );
    }
    case "button":
      return <ButtonBlock node={node as PageNode<"button">} />;
    case "image": {
      const p = node.props as BlockProps<"image">;
      return (
        <Frame node={node} className="w-full">
          <figure className="flex flex-col gap-2">
            <TextLink href={p.href ?? ""} className="block">
              <div className={cn("w-full overflow-hidden rounded-card", ASPECT[p.aspect], p.aspect === "auto" && !p.src.startsWith("product:") && "aspect-[4/3]")}>
                <MediaImage src={p.src} alt={p.alt} fit={p.fit} focal={p.focal} className="h-full w-full rounded-none" />
              </div>
            </TextLink>
            <T node={node} path="caption" value={p.caption} optional as="figcaption" placeholder="Caption" className="text-sm opacity-80" />
          </figure>
        </Frame>
      );
    }
    case "gallery": {
      const p = node.props as BlockProps<"gallery">;
      return (
        <Frame node={node} className="w-full">
          {p.images.length === 0 ? (
            <p className="rounded-card border border-dashed p-6 text-center text-sm opacity-70">Add images to the gallery.</p>
          ) : (
            <ul className={cn("grid grid-cols-2 gap-3", p.columns >= 3 && "@3xl/page:grid-cols-3", p.columns === 4 && "@5xl/page:grid-cols-4")}>
              {p.images.map((img, i) => (
                <li key={i} className="aspect-[4/3] overflow-hidden rounded-card">
                  <MediaImage src={img.src} alt={img.alt} className="h-full w-full rounded-none" />
                </li>
              ))}
            </ul>
          )}
        </Frame>
      );
    }
    case "video":
      return (
        <Frame node={node} className="w-full">
          <VideoBlock node={node} props={node.props as BlockProps<"video">} />
        </Frame>
      );
    case "table": {
      const p = node.props as BlockProps<"table">;
      const [head, ...body] = p.rows;
      return (
        <Frame node={node} className="w-full text-left">
          <ScrollRegion label="Table" className="w-full overflow-x-auto rounded-card border border-current/15">
            <table className="w-full min-w-[28rem] text-sm">
              {p.header && head && (
                <thead className="bg-current/[0.06]">
                  <tr>{head.map((c, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-semibold"><T node={node} path={`rows.0.${i}`} value={c} placeholder="Column heading" /></th>)}</tr>
                </thead>
              )}
              <tbody>
                {(p.header ? body : p.rows).map((r, i) => (
                  <tr key={i} className={cn("border-t border-current/10", p.striped && i % 2 === 1 && "bg-current/[0.04]")}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top [overflow-wrap:anywhere]"><T node={node} path={`rows.${i + (p.header ? 1 : 0)}.${j}`} value={c} placeholder="Cell" /></td>)}</tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </Frame>
      );
    }
    case "divider":
      return (
        <Frame node={node} className="w-full">
          <hr className="border-current/20" />
        </Frame>
      );
    case "spacer":
      return (
        <Frame node={node} className={cn("w-full", SPACER[(node.props as BlockProps<"spacer">).size], env.mode === "edit" && "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--muted)_6px,var(--muted)_12px)]")}>
          <span className="sr-only">Space</span>
        </Frame>
      );
    case "product_card": {
      const p = node.props as BlockProps<"product_card">;
      return (
        <Frame node={node} className="flex w-full justify-center">
          <ProductCardBlock productId={p.productId} showBuy={p.showBuy} />
        </Frame>
      );
    }
    case "product_grid":
      return (
        <Frame node={node} className="w-full">
          <ProductGridBlock props={node.props as BlockProps<"product_grid">} />
        </Frame>
      );
    case "highlights":
      return <HighlightsBlock node={node as PageNode<"highlights">} />;
    case "testimonials":
      return (
        <Frame node={node} className="w-full">
          <TestimonialsBlock props={node.props as BlockProps<"testimonials">} />
        </Frame>
      );
    case "faq":
      return <FaqBlock node={node as PageNode<"faq">} />;
    case "cards":
      return <CardsBlock node={node as PageNode<"cards">} />;
    case "card":
      return <CardBlock node={node as PageNode<"card">} />;
    case "collection_list":
      return <CollectionListBlock node={node as PageNode<"collection_list">} />;
    case "offers":
      return <OffersBlock node={node} />;
    case "about":
      return <AboutBlock node={node as PageNode<"about">} />;
    case "marquee":
      return <MarqueeBlock node={node as PageNode<"marquee">} />;
    case "custom_html": {
      const p = node.props as BlockProps<"custom_html">;
      return (
        <Frame node={node} className="w-full">
          {p.source ? (
            // Clicks inside the frame can't reach the editor, so a cover lets the block be selected
            <div className="relative">
              <HtmlSection html={{ name: p.name, source: p.source, height: p.height }} />
              {env.mode === "edit" && <div className="absolute inset-0" aria-hidden />}
            </div>
          ) : (
            <p className="rounded-card border border-dashed p-6 text-center text-sm opacity-70">Upload an HTML file in this block&apos;s settings.</p>
          )}
        </Frame>
      );
    }
    case "countdown": {
      const p = node.props as BlockProps<"countdown">;
      const valid = p.endsAt && !Number.isNaN(Date.parse(p.endsAt));
      return (
        <Frame node={node} className="flex flex-col items-center gap-2">
          {p.label && <p className="text-sm font-semibold opacity-90">{p.label}</p>}
          {valid ? <CountdownTimer endsAt={p.endsAt} className="text-foreground" /> : <p className="text-sm opacity-70">Set an end date.</p>}
        </Frame>
      );
    }
    case "lead_form":
      return (
        <Frame node={node} className="w-full text-left">
          <LeadFormBlock id={node.id} props={node.props as BlockProps<"lead_form">} env={{ editing: env.mode === "edit", onLead: env.onLead }} />
        </Frame>
      );
    case "booking":
      return (
        <Frame node={node} className="w-full text-left">
          <BookingBlock id={node.id} props={node.props as BlockProps<"booking">} env={{ editing: env.mode === "edit", onLead: env.onLead, loadBooked: env.loadBooked }} />
        </Frame>
      );
    case "newsletter": {
      const p = node.props as BlockProps<"newsletter">;
      return (
        <Frame node={node} className="w-full text-left text-foreground">
          <NewsletterForm heading={p.heading} body={p.body} onSubscribe={async (email) => (env.onSubscribe ? env.onSubscribe(email) : undefined)} />
        </Frame>
      );
    }
  }
}

const EMPTY = "rounded-card border border-dashed p-6 text-center text-sm opacity-70";

/**
 * An icon on the page. In the editor it is a button: clicking it opens the icon picker for this
 * spot, and the new icon shows straight away.
 */
function IconSlot({ node, path, name, weight, className }: { node: PageNode; path: string; name: string; weight: IconWeight; className?: string }) {
  const env = useContext(Env);
  const icon = <StoreIcon name={name} weight={weight} className={className} />;
  if (env.mode !== "edit" || !env.onIcon) return icon;
  return (
    <button
      type="button"
      data-pp-icon=""
      title="Change icon"
      aria-label="Change icon"
      onClick={(e) => {
        e.stopPropagation();
        env.onSelect?.(node.id);
        env.onIcon?.(node.id, path, name);
      }}
      className="grid place-items-center rounded-full outline-offset-2 hover:outline hover:outline-2 hover:outline-dashed hover:outline-current"
    >
      {icon}
    </button>
  );
}

function HighlightsBlock({ node }: { node: PageNode<"highlights"> }) {
  const ctx = useRenderContext();
  const p = node.props;
  const weight = p.iconWeight ?? "regular";
  const autoIcons = p.autoIcons ?? ["DownloadSimple", "ShieldCheck", "ArrowCounterClockwise", "Star"];
  const items: HighlightView[] =
    p.source === "auto"
      ? autoHighlights(ctx.store.refundDays, ctx.rating?.average ?? 0, ctx.rating?.count ?? 0).map((h, i) => ({ key: h.title, icon: <IconSlot node={node} path={`autoIcons.${i}`} name={autoIcons[i]} weight={weight} className="size-5" />, title: h.title, body: h.body }))
      : p.items.map((it, i) => ({
          key: String(i),
          icon: <IconSlot node={node} path={`items.${i}.icon`} name={it.icon} weight={weight} className="size-5" />,
          title: <T node={node} path={`items.${i}.title`} value={it.title} placeholder="Title" />,
          body: <T node={node} path={`items.${i}.body`} optional value={it.body} placeholder="A short line" />,
        }));
  return (
    <Frame node={node} className="w-full">
      {items.length ? <HighlightsStrip items={items} look={p.look ?? "strip"} /> : <p className={EMPTY}>Add points in this block&apos;s settings.</p>}
    </Frame>
  );
}

function FaqBlock({ node }: { node: PageNode<"faq"> }) {
  const ctx = useRenderContext();
  const env = useContext(Env);
  const p = node.props;
  const items = p.source === "store" ? (ctx.faq ?? []).slice(0, p.limit ?? 5) : p.items.map((it, i) => ({ id: `${node.id}-${i}`, q: it.q, a: it.a }));
  return (
    <Frame node={node} className="w-full text-left text-foreground">
      {items.length ? <FaqAccordion items={items} /> : <p className={EMPTY}>{p.source === "store" ? (env.mode === "edit" ? "Add questions in Store › Pages › FAQ." : "") : "Add questions and answers."}</p>}
    </Frame>
  );
}

const CARD_ASPECT = { none: "", "1:1": "aspect-square", "4:3": "aspect-[4/3]", "16:9": "aspect-video", "3:4": "aspect-[3/4]" } as const;
const CardsLook = createContext<BlockProps<"cards">>({ columns: 3, look: "card", aspect: "4:3" });

function CardsBlock({ node }: { node: PageNode<"cards"> }) {
  const p = node.props;
  const cols = p.columns === 2 ? "@3xl/page:grid-cols-2" : p.columns === 4 ? "@3xl/page:grid-cols-2 @5xl/page:grid-cols-4" : "@3xl/page:grid-cols-3";
  return (
    <Frame node={node} className={cn("grid w-full grid-cols-1 items-stretch @md/page:grid-cols-2", cols, GAP[node.layout.gap])}>
      <CardsLook.Provider value={p}>
        {node.children.map((c) => (
          <Block key={c.id} node={c} />
        ))}
      </CardsLook.Provider>
    </Frame>
  );
}

function CardBlock({ node }: { node: PageNode<"card"> }) {
  const look = useContext(CardsLook);
  const p = node.props;
  const align = node.style.align === "center" ? "items-center text-center" : node.style.align === "right" ? "items-end text-right" : "items-start text-left";
  return (
    <Frame node={node} className={cn("flex min-w-0 flex-col overflow-hidden", look.look === "card" && "rounded-card border border-current/15 bg-surface text-foreground")}>
      {look.aspect !== "none" && p.image && <MediaImage src={p.image} alt={p.imageAlt} className={cn("w-full", CARD_ASPECT[look.aspect], look.look === "plain" && "rounded-card")} />}
      <div className={cn("flex flex-1 flex-col gap-2", align, look.look === "card" ? "p-5" : "pt-3")}>
        {p.icon && (
          <span className="mb-1 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <IconSlot node={node} path="icon" name={p.icon} weight={p.iconWeight ?? "duotone"} className="size-6" />
          </span>
        )}
        <T node={node} path="title" value={p.title} as="h3" placeholder="Card title" className="font-display text-xl font-bold [overflow-wrap:anywhere]" />
        <T node={node} path="text" value={p.text} as="p" multiline placeholder="A line or two" optional className="text-sm leading-relaxed whitespace-pre-line opacity-80 [overflow-wrap:anywhere]" />
        {p.ctaLabel && (
          <TextLink href={p.ctaHref} className="mt-auto inline-flex min-h-11 items-center gap-1 pt-1 text-sm font-semibold text-primary hover:underline">
            <T node={node} path="ctaLabel" value={p.ctaLabel} placeholder="Link" /> <ArrowRight className="size-4" aria-hidden />
          </TextLink>
        )}
      </div>
    </Frame>
  );
}

function CollectionListBlock({ node }: { node: PageNode<"collection_list"> }) {
  const ctx = useRenderContext();
  const p = node.props;
  const list = ctx.collections.slice(0, p.limit);
  const cols = { 2: "@3xl/page:grid-cols-2", 3: "@3xl/page:grid-cols-3", 4: "@3xl/page:grid-cols-4", 6: "@3xl/page:grid-cols-3 @5xl/page:grid-cols-6" }[p.columns];
  return (
    <Frame node={node} className="w-full text-left text-foreground">
      {list.length ? (
        <ul className={cn("grid grid-cols-2 gap-3", cols)}>
          {list.map((c) => (
            <li key={c.id}>
              <CollectionTile collection={c} href={`/s/${ctx.store.slug}/c/${c.slug}`} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={EMPTY}>Your collections show here once you make some.</p>
      )}
    </Frame>
  );
}

function OffersBlock({ node }: { node: PageNode }) {
  const ctx = useRenderContext();
  const env = useContext(Env);
  const bundles = ctx.bundles ?? [];
  return (
    <Frame node={node} className="w-full text-left text-foreground">
      {bundles.length ? (
        <ul className="grid grid-cols-1 gap-3 @3xl/page:grid-cols-2">
          {bundles.map((b) => (
            <li key={b.bundle.id}>
              <BundleBox name={b.bundle.name} products={b.products} full={b.full} price={b.price} percentOff={b.percentOff} currency={env.currency} hrefFor={(prod) => `/s/${ctx.store.slug}/${prod.slug}`} onBuy={() => env.onBuyBundle?.(b.bundle.id)} buying={env.buying === b.bundle.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={EMPTY}>Your live bundles show here. Make one in Store › Offers.</p>
      )}
    </Frame>
  );
}

function AboutBlock({ node }: { node: PageNode<"about"> }) {
  const ctx = useRenderContext();
  const a = ctx.about;
  if (!a) return <Frame node={node}><p className={EMPTY}>Your story shows here.</p></Frame>;
  return (
    <Frame node={node} className="w-full text-left">
      <div className="grid grid-cols-1 items-center gap-6 rounded-card border border-current/15 p-6 @3xl/page:grid-cols-[auto_1fr] @3xl/page:p-10">
        {a.photo?.src ? (
          <MediaImage src={a.photo.src} alt={a.name} className="size-24 rounded-full @3xl/page:size-32" />
        ) : (
          <Avatar className="size-24 @3xl/page:size-32"><AvatarFallback className="bg-accent-soft font-display text-3xl text-accent-ink">{a.initials}</AvatarFallback></Avatar>
        )}
        <div className="flex flex-col items-start gap-3">
          <h2 className="font-display text-3xl font-extrabold">{a.name}</h2>
          {a.location && <p className="text-sm opacity-75">{a.location}</p>}
          <p className="max-w-2xl text-lg leading-relaxed whitespace-pre-line opacity-90">{a.story}</p>
          {node.props.showLink && <LinkButton href={`/s/${ctx.store.slug}/about`} label={`More about ${a.name.split(" ")[0]}`} variant="secondary" />}
        </div>
      </div>
    </Frame>
  );
}

function MarqueeBlock({ node }: { node: PageNode<"marquee"> }) {
  const env = useContext(Env);
  const p = node.props;
  const logos = p.mode === "logos";
  const items = p.items.map((it, i) => ({ it, i })).filter(({ it }) => (logos ? it.src : it.text.trim() || env.mode === "edit"));
  if (!items.length) return <Frame node={node} className="w-full"><p className={EMPTY}>Add {logos ? "logos" : "words"} in this block&apos;s settings.</p></Frame>;
  const cell = ({ it, i }: (typeof items)[number]) => {
    const inner = logos ? <span className="relative block h-9 w-28"><MediaImage src={it.src} alt={it.alt} decorative={!it.alt} fit="contain" className="absolute inset-0" /></span> : <T node={node} path={`items.${i}.text`} value={it.text} placeholder="Words" className="font-display text-xl whitespace-nowrap @3xl/page:text-2xl" />;
    return it.href && env.mode === "live" ? <TextLink href={it.href}>{inner}</TextLink> : inner;
  };
  // In the editor the strip holds still, so each phrase can be typed into where it is
  if (env.mode === "edit") {
    return (
      <Frame node={node} className="w-full">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-4">{items.map((x) => <span key={x.i} className="flex items-center gap-10">{cell(x)}</span>)}</div>
      </Frame>
    );
  }
  return (
    <Frame node={node} className="w-full">
      <Marquee label="Scrolling strip" speed={p.speed} reverse={p.direction === "right"} pauseOnHover={p.pauseOnHover} className="py-4 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]">
        {items.map((x) => (
          <span key={x.i} className="flex shrink-0 items-center gap-10 pr-10">
            {cell(x)}
            {!logos && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-40" />}
          </span>
        ))}
      </Marquee>
    </Frame>
  );
}

function RichText({ text }: { text: string }) {
  const env = useContext(Env);
  return (
    <>
      {parseInline(text).map((t, i) =>
        t.kind === "bold" ? (
          <strong key={i} className="font-semibold">{t.text}</strong>
        ) : t.kind === "italic" ? (
          <em key={i}>{t.text}</em>
        ) : t.kind === "link" ? (
          env.mode === "edit" ? (
            <span key={i} className="underline underline-offset-4">{t.text}</span>
          ) : t.href.startsWith("/") || t.href.startsWith("#") ? (
            <Link key={i} href={t.href} className="font-medium underline underline-offset-4">{t.text}</Link>
          ) : (
            <a key={i} href={t.href} rel="noopener noreferrer" target={t.href.startsWith("mailto:") ? undefined : "_blank"} className="font-medium underline underline-offset-4">{t.text}</a>
          )
        ) : (
          <span key={i}>{t.text}</span>
        )
      )}
    </>
  );
}

function ButtonBlock({ node }: { node: PageNode<"button"> }) {
  const p = node.props;
  const ctx = useRenderContext();
  const anchors = useContext(Anchors);
  let href = p.href;
  if (p.action === "product" && p.productId) {
    const prod = ctx.products.find((x) => x.id === p.productId);
    href = anchors.has(p.productId) ? `#p-${p.productId}` : prod ? `/s/${ctx.store.slug}/${prod.slug}` : "";
  }
  return (
    <Frame node={node} className="max-w-full">
      <LinkButton href={href} label={<T node={node} path="label" value={p.label} placeholder="Button" />} variant={p.variant} size={p.size} />
    </Frame>
  );
}

function productAnchors(nodes: PageNode[], out = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.type === "product_card" && (n.props as BlockProps<"product_card">).productId) out.add((n.props as BlockProps<"product_card">).productId);
    productAnchors(n.children, out);
  }
  return out;
}

/** Renders a page document. In edit mode, clicks select blocks instead of following links. */
export function PageRenderer({ doc, context, env, className }: { doc: PageDoc; context: RenderContext; env: RenderEnv; className?: string }) {
  const editing = env.mode === "edit";
  return (
    <Env.Provider value={env}>
      <Ctx.Provider value={context}>
       <Anchors.Provider value={productAnchors(doc.blocks)}>
       <FirstHero.Provider value={doc.blocks.find((b) => b.type === "hero")?.id}>
        <div
          className={cn("@container/page relative isolate w-full min-w-0 overflow-x-hidden", className)}
          style={doc.style ? { ...backgroundCss(doc.style.background), color: pageInk(doc.style) } : undefined}
          onClickCapture={
            editing
              ? (e) => {
                  // Icons open their own picker (and select their block themselves)
                  if ((e.target as HTMLElement).closest("[data-pp-icon]")) return;
                  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]");
                  if ((e.target as HTMLElement).closest("a, button, input, summary") && !(e.target as HTMLElement).closest(".pp-editable")) e.preventDefault();
                  if (el) {
                    e.stopPropagation();
                    env.onSelect?.(el.dataset.nodeId!);
                  }
                }
              : undefined
          }
        >
          {doc.style && <BackgroundLayer bg={doc.style.background} overlay={doc.style.overlay} overlayColor={doc.style.overlayColor} />}
          {doc.blocks.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center text-sm text-muted-foreground">{editing ? (env.between?.(0) ?? "Add a section to start.") : "This page is empty."}</div>
          ) : (
            <>
              {doc.blocks.map((b, i) => (
                <Fragment key={b.id}>
                  {editing && env.between?.(i)}
                  <Block node={b} />
                </Fragment>
              ))}
              {editing && env.between?.(doc.blocks.length)}
            </>
          )}
        </div>
       </FirstHero.Provider>
       </Anchors.Provider>
      </Ctx.Provider>
    </Env.Provider>
  );
}
