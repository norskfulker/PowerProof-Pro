"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Page, Product } from "@/lib/types";

/** Shared top bar for the visual and HTML editors. */
export function EditorBar({
  page,
  products,
  dirty,
  saving,
  onChange,
  onSave,
  modeSwitch,
}: {
  page: Page;
  products: Product[];
  dirty: boolean;
  saving: boolean;
  onChange: (p: Partial<Page>) => void;
  onSave: () => void;
  modeSwitch: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-card border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to pages">
          <Link href="/pages"><ArrowLeft /></Link>
        </Button>
        <label htmlFor="pg-name" className="sr-only">Page name</label>
        <Input id="pg-name" value={page.title} onChange={(e) => onChange({ title: e.target.value })} className="h-10 max-w-sm flex-1 font-display text-lg font-extrabold" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href={modeSwitch.href}>{modeSwitch.label}</Link></Button>
          <Button onClick={onSave} disabled={saving || !dirty}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            {dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="pg-prod" className="text-sm text-muted-foreground">Sells</label>
          <Select value={page.productIds[0] ?? ""} onValueChange={(v) => onChange({ productIds: [v] })}>
            <SelectTrigger id="pg-prod" size="sm" className="w-64 max-w-full">
              <SelectValue placeholder="Pick a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-3 sm:ml-auto">
          <span className="text-sm">{page.status === "live" ? "Live" : "Draft"}</span>
          <Switch checked={page.status === "live"} onCheckedChange={(c) => onChange({ status: c ? "live" : "draft" })} aria-label="Page is live" />
        </label>
      </div>
    </div>
  );
}

export function EditorSkeletonOrError({ error, onRetry }: { error?: string; onRetry: () => void }) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border bg-danger-soft p-10 text-center" role="alert">
        <p className="font-display text-lg">That page didn&apos;t load.</p>
        <p className="text-sm">{error}</p>
        <Button variant="secondary" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="h-32 animate-pulse rounded-card bg-muted" />
      <div className="h-[520px] animate-pulse rounded-card bg-muted" />
    </div>
  );
}
