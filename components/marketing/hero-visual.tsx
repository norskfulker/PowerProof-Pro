import { Download, IndianRupee, ShieldCheck } from "lucide-react";
import { CoverArt } from "@/components/pp/product-cover";

/** Illustration for the home hero: a buyer's product page with a sale landing on top. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]" aria-hidden>
      <div className="rounded-dialog border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-[8px] bg-primary font-mono text-[0.625rem] font-semibold text-primary-foreground">AM</span>
          <span className="text-sm font-semibold">Ananya Makes</span>
          <span className="ml-auto font-mono text-[0.6875rem] text-muted-foreground">powerproof.store/ananya</span>
        </div>
        <CoverArt
          cover={{ template: "split", title: "Second Brain for Founders", subtitle: "Notion kit", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" }}
        />
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-semibold">Second Brain for Founders</p>
            <p className="text-sm text-muted-foreground">Notion workspace · instant access</p>
          </div>
          <p className="font-display text-2xl">$17.99</p>
        </div>
        <div className="mt-4 flex h-12 items-center justify-center rounded-control bg-primary font-semibold text-primary-foreground">Buy now</div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Download className="size-3.5" /> Instant download</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Secure payment</span>
        </div>
      </div>

      <div className="absolute -top-5 -right-2 w-64 rounded-card border bg-surface p-3.5 shadow-pop sm:-right-10">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-success-soft text-success">
            <IndianRupee className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">New sale · ₹1,499.00</p>
            <p className="truncate text-xs text-muted-foreground">Emily in Austin, paid in USD</p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-2 rounded-card border bg-foreground px-4 py-3 text-primary-foreground sm:-left-10">
        <p className="font-mono text-[0.625rem] tracking-[0.08em] uppercase opacity-70">You keep</p>
        <p className="font-display text-2xl text-accent">₹1,424.05</p>
      </div>
    </div>
  );
}
