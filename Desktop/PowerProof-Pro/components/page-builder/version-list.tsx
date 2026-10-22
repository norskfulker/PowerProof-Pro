"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { Button } from "@/components/ui/button";
import type { RenderContext } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { PageVersion } from "@/lib/pages/schema";
import { PageRenderer } from "./renderer";

/** Published versions, newest first. Preview any of them; restore copies it into the draft. */
export function VersionList({ versions, context, onRestore }: { versions: PageVersion[]; context: RenderContext; onRestore: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState<string>();
  const [restore, setRestore] = useState<PageVersion>();
  if (!versions.length) return <p className="rounded-card border border-dashed bg-surface p-6 text-center text-sm text-muted-foreground">No versions yet. Each time you publish, a version is saved here.</p>;
  return (
    <>
      <ol className="flex flex-col gap-3">
        {versions.map((v, i) => (
          <li key={v.id} className="rounded-card border bg-surface">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">
                  {v.label}
                  {i === 0 && <span className="ml-2 text-xs font-normal text-success">Live now</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(v.at, { time: true })} · {v.doc.blocks.length} section{v.doc.blocks.length === 1 ? "" : "s"}
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" aria-expanded={open === v.id} aria-controls={`pv-${v.id}`} onClick={() => setOpen(open === v.id ? undefined : v.id)}>
                <ChevronDown aria-hidden className={open === v.id ? "rotate-180" : undefined} /> {open === v.id ? "Hide preview" : "Preview"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRestore(v)}>
                <RotateCcw aria-hidden /> Restore
              </Button>
            </div>
            {open === v.id && (
              <div id={`pv-${v.id}`} className="border-t bg-surface-sunken p-3">
                <div className="mx-auto max-h-[32rem] max-w-3xl overflow-auto rounded-card border bg-background">
                  <StoreThemeScope theme={context.theme}>
                    <PageRenderer doc={v.doc} context={context} env={{ mode: "edit", currency: "INR" }} />
                  </StoreThemeScope>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <ConfirmDialog
        open={!!restore}
        onOpenChange={(o) => !o && setRestore(undefined)}
        title="Restore this version?"
        description="It replaces your current draft. Buyers keep seeing the live page until you publish."
        confirmLabel="Restore to draft"
        onConfirm={async () => {
          if (restore) await onRestore(restore.id);
        }}
      />
    </>
  );
}
