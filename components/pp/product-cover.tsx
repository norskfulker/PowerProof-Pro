/* eslint-disable @next/next/no-img-element */
import type { CoverSpec, ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Renders a generated product cover (or a real image). Cover colours are creator data,
 * so they're applied inline; everything else uses tokens.
 */
export function CoverArt({ cover, className, size = "md" }: { cover: CoverSpec; className?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const { template, title, subtitle, bg, fg, accent } = cover;
  const titleSize = size === "sm" ? "text-[13px]" : size === "lg" ? "text-[clamp(28px,5vw,44px)]" : "text-[clamp(18px,3vw,24px)]";
  const pad = size === "xs" ? "p-1" : size === "sm" ? "p-2.5" : size === "lg" ? "p-8" : "p-5";

  return (
    <div
      className={cn("relative flex aspect-[4/3] w-full overflow-hidden rounded-media font-display", pad, className)}
      style={{ background: bg, color: fg }}
      role="img"
      aria-label={title}
    >
      {template === "split" && <div className="absolute inset-y-0 right-0 w-[38%]" style={{ background: accent, opacity: 0.9 }} />}
      {template === "frame" && <div className="absolute inset-3 rounded-[8px] border-2" style={{ borderColor: accent }} />}
      {template === "grid" && size !== "xs" && (
        <div className="absolute right-4 bottom-4 grid grid-cols-3 gap-1.5 opacity-90" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="size-3 rounded-[3px] sm:size-4" style={{ background: i % 4 === 0 ? accent : fg, opacity: i % 4 === 0 ? 1 : 0.25 }} />
          ))}
        </div>
      )}
      {template === "stack" && (
        <div className="absolute right-[-10%] bottom-[-20%] size-[70%] rotate-12 rounded-[14px]" style={{ background: accent, opacity: 0.85 }} />
      )}
      {template === "badge" && size !== "xs" && (
        <div className="absolute top-4 right-4 grid size-12 place-items-center rounded-full text-[10px] font-bold sm:size-14" style={{ background: accent, color: bg }}>
          NEW
        </div>
      )}
      {size !== "xs" && <div className={cn("relative z-10 mt-auto flex max-w-[78%] flex-col gap-1.5", template === "split" && "max-w-[58%]")}>
        {subtitle && size !== "sm" && (
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-80">{subtitle}</span>
        )}
        <span className={cn("leading-[1.05] font-extrabold tracking-[-0.02em]", titleSize, size === "sm" && "line-clamp-3")}>{title}</span>
        {template === "block" && <span className="mt-1 h-1 w-10 rounded-full" style={{ background: accent }} />}
      </div>}
    </div>
  );
}

export function ProductImageView({ image, className, size }: { image?: ProductImage; className?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  if (!image) {
    return <div className={cn("aspect-[4/3] w-full rounded-media bg-muted", className)} aria-hidden />;
  }
  if (image.src) {
    return <img src={image.src} alt={image.alt} className={cn("aspect-[4/3] w-full rounded-media object-cover", className)} />;
  }
  if (image.cover) return <CoverArt cover={image.cover} className={className} size={size} />;
  return <div className={cn("aspect-[4/3] w-full rounded-media bg-muted", className)} aria-hidden />;
}
