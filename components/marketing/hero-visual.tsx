import { BadgeCheck, CreditCard, FileCheck2, Landmark, Smartphone } from "lucide-react";

/**
 * The home page's picture: a store, a payment going through and the file and invoice going out,
 * drawn from shapes rather than made-up products or numbers (no sample content, DESIGN.md §1).
 * Decorative: the copy beside it says the same thing.
 */
export function HeroVisual() {
  return (
    <div aria-hidden className="relative mx-auto hidden w-full max-w-[520px] select-none lg:block">
      {/* The store */}
      <div className="rounded-dialog border bg-surface p-5 shadow-deep">
        <div className="flex items-center gap-3">
          <span className="size-9 rounded-[10px] bg-primary" />
          <span className="h-3 w-28 rounded-full bg-foreground/80" />
          <span className="ml-auto h-8 w-36 rounded-full border bg-surface-sunken" />
        </div>
        <div className="grain bg-mesh-forest mt-5 h-28 overflow-hidden rounded-card p-4">
          <span className="block h-3.5 w-40 rounded-full bg-white/85" />
          <span className="mt-2 block h-2.5 w-56 rounded-full bg-white/40" />
          <span className="mt-4 block h-7 w-24 rounded-full bg-white shadow-xs" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {["bg-[linear-gradient(140deg,#ffe2a8,#ffc3a6)]", "bg-[linear-gradient(140deg,#c7e8fb,#b7f0d2)]", "bg-[linear-gradient(140deg,#d4f27a,#7ee8c0)]"].map((bg, i) => (
            <div key={i} className="overflow-hidden rounded-media border">
              <div className={`aspect-[4/3] ${bg}`} />
              <div className="p-2.5">
                <span className="block h-2 w-16 rounded-full bg-foreground/60" />
                <span className="mt-2 block h-2 w-10 rounded-full bg-foreground/25" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* A payment going through */}
      <div className="absolute -bottom-8 -left-10 w-64 rounded-card border bg-surface/90 p-4 shadow-deep backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-semibold text-success">
          <BadgeCheck className="size-5" /> Paid
        </div>
        <span className="mt-3 block h-3 w-32 rounded-full bg-foreground/70" />
        <span className="mt-2 block h-2 w-20 rounded-full bg-foreground/25" />
        <div className="mt-4 flex gap-2 text-muted-foreground">
          {[Smartphone, CreditCard, Landmark].map((Icon, i) => (
            <span key={i} className="grid size-8 place-items-center rounded-control bg-surface-sunken"><Icon className="size-4" /></span>
          ))}
        </div>
      </div>

      {/* What goes out after */}
      <div className="absolute -top-5 -right-6 flex flex-col gap-2">
        {["File delivered", "Invoice sent"].map((t) => (
          <span key={t} className="flex items-center gap-2 rounded-full border bg-surface/90 px-3.5 py-2 text-sm font-medium shadow-lift backdrop-blur-md">
            <FileCheck2 className="size-4 text-primary" /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}
