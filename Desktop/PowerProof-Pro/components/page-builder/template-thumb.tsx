import { thumbnailBackground } from "@/lib/pages/template-art";
import { cn } from "@/lib/utils";

/** A white bar for the sketches */
const B = ({ className }: { className?: string }) => <span className={cn("block rounded-full bg-white", className)} />;

/** What each ready-made page looks like, drawn in a few shapes on its own gradient */
function Shape({ template }: { template: string }) {
  switch (template) {
    case "launch":
      return (
        <span className="grid h-full grid-cols-[1.2fr_1fr] items-center gap-3">
          <span className="flex flex-col gap-1.5">
            <B className="h-1.5 w-8 opacity-60" />
            <B className="h-3 w-full" />
            <B className="h-3 w-3/4" />
            <B className="mt-1 h-1.5 w-5/6 opacity-60" />
            <span className="mt-2 block h-4 w-14 rounded-full bg-white shadow-[0_4px_12px_-2px_rgb(0_0_0/0.35)]" />
          </span>
          <span className="pp-float block aspect-[4/5] rounded-[8px] bg-white/25 shadow-[0_10px_24px_-8px_rgb(0_0_0/0.5)] ring-1 ring-white/40 backdrop-blur-sm" />
        </span>
      );
    case "sale":
      return (
        <span className="flex h-full flex-col items-center justify-center gap-2">
          <B className="h-3 w-3/4" />
          <span className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => <span key={i} className="grid size-6 place-items-center rounded-[5px] bg-white/25 text-[0.5625rem] font-bold text-white ring-1 ring-white/40">{["04", "12", "36", "08"][i]}</span>)}
          </span>
          <span className="mt-1 grid w-5/6 grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="pp-float block h-7 rounded-[5px] bg-white/30" style={{ animationDelay: `${i * 0.3}s` }} />)}</span>
        </span>
      );
    case "home":
      return (
        <span className="flex h-full flex-col gap-2">
          <span className="flex items-center justify-between">
            <span className="block size-3 rounded-full bg-white" />
            <span className="flex gap-1">{[0, 1, 2].map((i) => <B key={i} className="h-1 w-4 opacity-60" />)}</span>
          </span>
          <span className="flex flex-col items-center gap-1.5 pt-1">
            <B className="h-3 w-1/2" />
            <B className="h-1.5 w-1/3 opacity-60" />
            <span className="mt-1 block h-3.5 w-12 rounded-full bg-white shadow-[0_4px_12px_-2px_rgb(0_0_0/0.35)]" />
          </span>
          <span className="mt-auto grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className="pp-float block h-7 rounded-[5px] bg-white/30" style={{ animationDelay: `${i * 0.25}s` }} />)}</span>
        </span>
      );
    case "bio":
      return (
        <span className="mx-auto flex h-full w-3/5 flex-col items-center justify-center gap-1.5">
          <span className="mb-1 block size-7 rounded-full bg-white shadow-[0_4px_12px_-2px_rgb(0_0_0/0.35)]" />
          {[0, 1, 2, 3].map((i) => <span key={i} className={cn("block h-3.5 w-full rounded-full", i === 0 ? "bg-white" : "bg-white/30 ring-1 ring-white/40")} />)}
        </span>
      );
    case "lead":
    case "squeeze":
      return (
        <span className="mx-auto flex h-full w-4/5 flex-col items-center justify-center gap-1.5">
          <B className="h-3 w-full" />
          <B className="h-1.5 w-2/3 opacity-60" />
          <span className="mt-2 flex w-full flex-col gap-1 rounded-[8px] bg-white/20 p-2 ring-1 ring-white/35 backdrop-blur-sm">
            <span className="block h-3 rounded-[4px] bg-white/80" />
            <span className="block h-3 rounded-[4px] bg-white/80" />
            <span className="block h-3.5 rounded-full bg-white" />
          </span>
        </span>
      );
    case "booking":
      return (
        <span className="mx-auto flex h-full w-4/5 flex-col justify-center gap-2">
          <B className="h-2.5 w-2/3" />
          <span className="grid grid-cols-7 gap-1 rounded-[8px] bg-white/20 p-1.5 ring-1 ring-white/35">
            {Array.from({ length: 14 }, (_, i) => <span key={i} className={cn("block aspect-square rounded-[3px]", i === 9 ? "bg-white" : "bg-white/30")} />)}
          </span>
        </span>
      );
    case "clickthrough":
      return (
        <span className="flex h-full flex-col justify-center gap-1.5">
          <B className="h-3 w-4/5" />
          <B className="h-1.5 w-3/5 opacity-60" />
          <span className="mt-1 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="block h-6 flex-1 rounded-[5px] bg-white/25 ring-1 ring-white/35" />)}</span>
          <span className="mt-1 flex items-center gap-1 self-start rounded-full bg-white px-2.5 py-1"><span className="block h-1.5 w-8 rounded-full bg-black/60" /><span className="pp-nudge text-[0.625rem] leading-none font-bold text-black/70">→</span></span>
        </span>
      );
    default:
      return (
        <span className="grid h-full place-items-center">
          <span className="grid size-10 place-items-center rounded-full border-2 border-dashed border-white/60 text-xl font-light text-white">+</span>
        </span>
      );
  }
}

/** A ready-made page's thumbnail: its gradient, a little grain, and the page's shape */
export function TemplateThumb({ template, className }: { template: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grain relative block aspect-[16/10] overflow-hidden rounded-media p-4", className)} style={{ background: thumbnailBackground(template) }}>
      <span className="relative block h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]">
        <Shape template={template} />
      </span>
    </span>
  );
}
