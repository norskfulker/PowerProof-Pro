"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Download, Globe, Heart, ImageOff, Play, RotateCcw, ShieldCheck, Star, Zap, type LucideIcon } from "lucide-react";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { NewsletterForm } from "@/components/pp/newsletter-form";
import { CoverArt, ImagePlaceholder } from "@/components/pp/product-cover";
import { ScrollRegion } from "@/components/pp/scroll-region";
import { StoreProductCard } from "@/components/pp/store-product-card";
import type { RenderContext } from "@/lib/api";
import { contrast } from "@/lib/color";
import { assetUrl } from "@/lib/media/store";
import { paragraphs, parseInline } from "@/lib/pages/rich-text";
import { HIGHLIGHT_ICONS, type Background, type BlockProps, type BlockStyle, type PageDoc, type PageNode } from "@/lib/pages/schema";
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
  buying?: string;
  onSubscribe?: (email: string) => Promise<void>;
  /** Editor only */
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const Env = createContext<RenderEnv>({ mode: "live", currency: "INR" });
const Ctx = createContext<RenderContext | null>(null);
const useRenderContext = () => useContext(Ctx)!;
/** Product ids that have a card on this page, so "scroll to product" buttons can jump to them */
const Anchors = createContext<Set<string>>(new Set());

const ICONS: Record<(typeof HIGHLIGHT_ICONS)[number], LucideIcon> = { check: Check, download: Download, shield: ShieldCheck, refund: RotateCcw, star: Star, zap: Zap, heart: Heart, globe: Globe };

/* ------------------------------------------------------------------ */
/* Scales                                                               */
/* ------------------------------------------------------------------ */

const PAD = { none: "py-0", sm: "py-6", md: "py-10 @3xl/page:py-14", lg: "py-14 @3xl/page:py-20", xl: "py-20 @3xl/page:py-28" } as const;
const WIDTH = { narrow: "max-w-2xl", normal: "max-w-4xl", wide: "max-w-6xl", full: "max-w-none" } as const;
const MIN_H = { auto: "", sm: "min-h-64", md: "min-h-96", lg: "min-h-[36rem]", screen: "min-h-svh" } as const;
const GAP = { sm: "gap-3", md: "gap-5", lg: "gap-8" } as const;
const HEADING = { sm: "text-xl @3xl/page:text-2xl", md: "text-2xl @3xl/page:text-3xl", lg: "text-[clamp(1.75rem,6cqw,2.75rem)]", xl: "text-[clamp(2.25rem,8cqw,4rem)]" } as const;
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
  const [state, setState] = useState<{ src: string; url?: string; missing: boolean }>({ src, url: src.startsWith("https://") ? src : undefined, missing: false });
  useEffect(() => {
    if (!src.startsWith("asset:")) return;
    let alive = true;
    assetUrl(src).then((url) => alive && setState({ src, url, missing: !url }));
    return () => {
      alive = false;
    };
  }, [src]);
  if (state.src !== src) return { url: src.startsWith("https://") ? src : undefined, missing: false };
  return state;
}

function MediaImage({ src, alt, className, fit = "cover", focal, decorative }: { src: string; alt: string; className?: string; fit?: "cover" | "contain"; focal?: { x: number; y: number }; decorative?: boolean }) {
  const ctx = useRenderContext();
  const media = useMedia(src.startsWith("product:") ? "" : src);
  if (src.startsWith("product:")) {
    const p = ctx.products.find((x) => x.id === src.slice(8));
    const cover = p?.images[0]?.cover;
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
  return <img src={media.url} alt={decorative ? "" : alt} loading="lazy" className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain", className)} style={focal ? { objectPosition: `${focal.x}% ${focal.y}%` } : undefined} />;
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
          {video.url && <video src={video.url} poster={undefined} autoPlay muted loop playsInline className="absolute inset-0 hidden h-full w-full object-cover motion-safe:@3xl/page:block" style={{ objectPosition: focal }} />}
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

function Frame({ node, className, children, as: Tag = "div", style }: { node: PageNode; className?: string; children: React.ReactNode; as?: "div" | "section"; style?: React.CSSProperties }) {
  const env = useContext(Env);
  const selected = env.mode === "edit" && env.selectedId === node.id;
  return (
    <Tag
      data-node-id={env.mode === "edit" ? node.id : undefined}
      data-node-type={env.mode === "edit" ? node.type : undefined}
      className={cn(
        visibilityClass(node.visibility, env.mode),
        boxClass(node.style),
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

function SectionBlock({ node }: { node: PageNode }) {
  const tone = node.style.tone === "auto" ? autoTone(node.style) : node.style.tone;
  return (
    <Frame
      node={node}
      as="section"
      className={cn("relative isolate flex flex-col justify-center px-4 @3xl/page:px-8", PAD[node.layout.paddingY], MIN_H[node.layout.minHeight])}
      style={{ ...backgroundCss(node.style.background), color: tone === "light" ? LIGHT : tone === "dark" ? DARK : undefined }}
    >
      <BackgroundLayer bg={node.style.background} overlay={node.style.overlay} overlayColor={node.style.overlayColor} />
      <div className={cn("mx-auto w-full", WIDTH[node.layout.width])}>
        <Stack nodes={node.children} gap={node.layout.gap} align={node.style.align} />
      </div>
    </Frame>
  );
}

function HeroBlock({ node }: { node: PageNode<"hero"> }) {
  const p = node.props;
  const tone = node.style.tone === "auto" ? autoTone(node.style) : node.style.tone;
  const split = p.layout === "split";
  const centered = p.layout === "centered";
  return (
    <Frame
      node={node}
      as="section"
      className={cn("relative isolate flex flex-col justify-center px-4 @3xl/page:px-8", PAD[node.layout.paddingY], MIN_H[node.layout.minHeight])}
      style={{ ...backgroundCss(node.style.background), color: tone === "light" ? LIGHT : tone === "dark" ? DARK : undefined }}
    >
      <BackgroundLayer bg={node.style.background} overlay={node.style.overlay} overlayColor={node.style.overlayColor} />
      <div className={cn("mx-auto grid w-full items-center gap-8", WIDTH[node.layout.width], split && p.image ? "grid-cols-1 @3xl/page:grid-cols-2" : "grid-cols-1")}>
        <div className={cn("flex min-w-0 flex-col gap-4", centered && "items-center text-center")}>
          {p.eyebrow && <p className="font-mono text-xs tracking-[0.08em] uppercase opacity-80">{p.eyebrow}</p>}
          <h1 className="font-display text-[clamp(2rem,7cqw,3.75rem)] leading-[1.02] font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere]">{p.headline}</h1>
          {p.subtext && <p className="max-w-xl text-lg opacity-90 [overflow-wrap:anywhere]">{p.subtext}</p>}
          {p.ctaLabel && <LinkButton href={p.ctaHref} label={p.ctaLabel} variant={tone === "light" ? "brass" : "primary"} />}
        </div>
        {split && p.image && <MediaImage src={p.image} alt={p.imageAlt} className="aspect-[4/3] w-full rounded-card" />}
      </div>
    </Frame>
  );
}

function LinkButton({ href, label, variant, size = "md" }: { href: string; label: string; variant: "primary" | "secondary" | "brass"; size?: keyof typeof BUTTON_SIZE }) {
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

function VideoBlock({ props }: { props: BlockProps<"video"> }) {
  const media = useMedia(props.src);
  const poster = useMedia(props.poster);
  const external = props.src.startsWith("https://") && !/\.(mp4|webm)(\?|$)/i.test(props.src);
  return (
    <figure className="flex w-full flex-col gap-2">
      {!props.src ? (
        <div className="grid aspect-video place-items-center rounded-card bg-muted text-muted-foreground" role="img" aria-label="No video yet">
          <Play className="size-8" aria-hidden />
        </div>
      ) : external ? (
        // Third-party players run scripts; link out instead of embedding
        <a href={props.src} target="_blank" rel="noopener noreferrer" className="grid aspect-video place-items-center rounded-card bg-black/80 text-white">
          <span className="inline-flex items-center gap-2 font-semibold"><Play className="size-6" aria-hidden /> Watch the video</span>
        </a>
      ) : (
        <video src={media.url} poster={poster.url} controls preload="metadata" className="aspect-video w-full rounded-card bg-black" />
      )}
      {props.caption && <figcaption className="text-sm opacity-80">{props.caption}</figcaption>}
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
        <Frame node={node} className={cn("grid w-full items-start", GAP[node.layout.gap], p.stackOnMobile ? cn("grid-cols-1", tpl) : n === 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-4")}>
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
      return (
        <Frame node={node}>
          <H className={cn("font-display leading-[1.08] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]", HEADING[p.size])}>{p.text}</H>
        </Frame>
      );
    }
    case "text": {
      const p = node.props as BlockProps<"text">;
      return (
        <Frame node={node} className={cn("flex max-w-prose flex-col gap-3 [overflow-wrap:anywhere]", TEXT[p.size])}>
          {paragraphs(p.text || (env.mode === "edit" ? "Write something…" : "")).map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              <RichText text={para} />
            </p>
          ))}
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
            <div className={cn("w-full overflow-hidden rounded-card", ASPECT[p.aspect], p.aspect === "auto" && !p.src.startsWith("product:") && "aspect-[4/3]")}>
              <MediaImage src={p.src} alt={p.alt} fit={p.fit} focal={p.focal} className="h-full w-full rounded-none" />
            </div>
            {p.caption && <figcaption className="text-sm opacity-80">{p.caption}</figcaption>}
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
          <VideoBlock props={node.props as BlockProps<"video">} />
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
                  <tr>{head.map((c, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-semibold">{c}</th>)}</tr>
                </thead>
              )}
              <tbody>
                {(p.header ? body : p.rows).map((r, i) => (
                  <tr key={i} className={cn("border-t border-current/10", p.striped && i % 2 === 1 && "bg-current/[0.04]")}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top [overflow-wrap:anywhere]">{c}</td>)}</tr>
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
        <Frame node={node} className={cn("w-full", SPACER[(node.props as BlockProps<"spacer">).size], env.mode === "edit" && "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgb(0_0_0/0.04)_6px,rgb(0_0_0/0.04)_12px)]")}>
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
    case "highlights": {
      const p = node.props as BlockProps<"highlights">;
      return (
        <Frame node={node} className="w-full">
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3 text-left">
            {p.items.map((it, i) => {
              const Icon = ICONS[it.icon] ?? Check;
              return (
                <li key={i} className="flex items-start gap-3 rounded-card border border-current/15 p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-current/[0.08]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold [overflow-wrap:anywhere]">{it.title}</span>
                    {it.body && <span className="text-sm opacity-80 [overflow-wrap:anywhere]">{it.body}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Frame>
      );
    }
    case "testimonials":
      return (
        <Frame node={node} className="w-full">
          <TestimonialsBlock props={node.props as BlockProps<"testimonials">} />
        </Frame>
      );
    case "faq": {
      const p = node.props as BlockProps<"faq">;
      return (
        <Frame node={node} className="w-full text-left text-foreground">
          {p.items.length ? <FaqAccordion items={p.items.map((it, i) => ({ id: `${node.id}-${i}`, q: it.q, a: it.a }))} /> : <p className="rounded-card border border-dashed p-6 text-center text-sm opacity-70">Add questions and answers.</p>}
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
      <LinkButton href={href} label={p.label} variant={p.variant} size={p.size} />
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
        <div
          className={cn("@container/page relative isolate w-full min-w-0 overflow-x-hidden", className)}
          style={doc.style ? { ...backgroundCss(doc.style.background), color: pageInk(doc.style) } : undefined}
          onClickCapture={
            editing
              ? (e) => {
                  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]");
                  if ((e.target as HTMLElement).closest("a, button, input, summary")) e.preventDefault();
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
            <div className="grid min-h-64 place-items-center p-8 text-center text-sm text-muted-foreground">{editing ? "Add a section to start." : "This page is empty."}</div>
          ) : (
            doc.blocks.map((b) => <Block key={b.id} node={b} />)
          )}
        </div>
       </Anchors.Provider>
      </Ctx.Provider>
    </Env.Provider>
  );
}
