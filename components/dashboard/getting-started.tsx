"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  label: string;
  body: string;
  href: string;
  done: boolean;
}

/** Shown on a brand-new account instead of empty charts. */
export function GettingStarted({ items, storeName }: { items: ChecklistItem[]; storeName: string }) {
  const done = items.filter((i) => i.done).length;
  return (
    <section aria-labelledby="gs-h" className="rounded-card border bg-surface">
      <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="eyebrow">New store</p>
          <h2 id="gs-h" className="mt-1 text-2xl">Let&apos;s get {storeName} its first sale.</h2>
          <p className="mt-1 text-muted-foreground">Four small things. Most people finish in five minutes.</p>
        </div>
        <div className="w-full md:w-56">
          <p className="mb-2 font-mono text-xs text-muted-foreground">
            {done} of {items.length} done
          </p>
          <Progress value={(done / items.length) * 100} aria-label="Setup progress" />
        </div>
      </div>
      <ol className="divide-y">
        {items.map((it, i) => (
          <li key={it.label}>
            <Link href={it.href} className="flex items-center gap-4 px-5 py-4 hover:bg-muted md:px-6">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border font-mono text-xs",
                  it.done ? "border-primary bg-primary text-primary-foreground" : "bg-surface"
                )}
              >
                {it.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-semibold", it.done && "text-muted-foreground line-through")}>{it.label}</span>
                <span className="block text-sm text-muted-foreground">{it.body}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
