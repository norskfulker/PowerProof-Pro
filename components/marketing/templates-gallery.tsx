"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TemplateCard } from "@/components/pp/template-card";
import { TemplatePreview } from "@/components/pages/template-preview";
import { TEMPLATES, type TemplateMeta } from "@/lib/templates";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Ebooks and kits", "Presets and packs", "Bundles", "Link in bio", "Upcoming launches", "Full control"];

export function TemplatesGallery() {
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<TemplateMeta | null>(null);
  const list = TEMPLATES.filter((t) => filter === "All" || t.bestFor === filter);

  return (
    <>
      <div role="group" aria-label="Filter templates" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "min-h-10 shrink-0 rounded-control border px-4 text-sm font-medium whitespace-nowrap transition-colors",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:border-border-strong"
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <TemplateCard key={t.id} template={t} onSelect={() => setOpen(t)} />
        ))}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">{open.name}</SheetTitle>
                <SheetDescription>{open.description}</SheetDescription>
              </SheetHeader>
              <div className="mx-4 overflow-hidden rounded-card border">
                <TemplatePreview template={open.id} />
              </div>
              <SheetFooter className="flex-row justify-end">
                <Button variant="secondary" onClick={() => setOpen(null)}>
                  Keep looking
                </Button>
                <Button asChild>
                  <Link href={`/signup?template=${open.id}`}>
                    Use this template <ArrowRight />
                  </Link>
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
