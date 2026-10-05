"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { useApi } from "@/hooks/use-api";
import { getStore, getStoreDesign, updateStoreDesign } from "@/lib/api";
import { SITE_URL } from "@/lib/format";
import type { StoreDesign } from "@/lib/types";

const SOCIALS = [["instagram", "Instagram"], ["youtube", "YouTube"], ["x", "X"], ["website", "Website"]] as const;

export default function StoreSeoPage() {
  const saved = useApi(getStoreDesign, []);
  const store = useApi(getStore, []);
  const [draft, setDraft] = useState<StoreDesign>();
  const [saving, setSaving] = useState(false);
  if (saved.error) return <ErrorState message={saved.error} onRetry={saved.reload} />;
  if (!saved.data || !store.data) return <Skeleton className="h-[520px] rounded-card" />;
  const d = draft ?? saved.data;
  const titleLen = d.seo.title.length;
  const descLen = d.seo.description.length;

  return (
    <>
      <PageHeader
        title="Search and social"
        description="How your store looks in Google and when someone shares the link."
        actions={
          <>
            <Button asChild variant="ghost"><Link href="/store/domain">Custom domain</Link></Button>
            <Button disabled={!draft || saving} onClick={async () => {
              setSaving(true);
              try {
                saved.setData(await updateStoreDesign(d));
                setDraft(undefined);
                toast.success("Saved");
              } finally {
                setSaving(false);
              }
            }}>{saving && <Loader2 className="animate-spin" aria-hidden />}{draft ? "Save" : "Saved"}</Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-label="Search listing" className="flex flex-col gap-4 rounded-card border bg-surface p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seo-t">Page title</Label>
            <Input id="seo-t" value={d.seo.title} onChange={(e) => setDraft({ ...d, seo: { ...d.seo, title: e.target.value } })} aria-describedby="seo-t-h" />
            <p id="seo-t-h" className={titleLen > 60 ? "text-sm font-medium text-warning-ink" : "text-sm text-muted-foreground"}>{titleLen} of 60 characters{titleLen > 60 ? ". Google will cut the end." : ""}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seo-d">Description</Label>
            <Textarea id="seo-d" rows={3} value={d.seo.description} onChange={(e) => setDraft({ ...d, seo: { ...d.seo, description: e.target.value } })} aria-describedby="seo-d-h" />
            <p id="seo-d-h" className={descLen > 160 ? "text-sm font-medium text-warning-ink" : "text-sm text-muted-foreground"}>{descLen} of 160 characters</p>
          </div>
          <div className="rounded-control border bg-surface-sunken p-4" aria-label="Google preview">
            <p className="eyebrow mb-2">Google preview</p>
            <p className="truncate text-xs text-muted-foreground">{SITE_URL} › {store.data.slug}</p>
            <p className="truncate text-lg text-info">{d.seo.title || store.data.name}</p>
            <p className="line-clamp-2 text-sm text-foreground/80">{d.seo.description}</p>
          </div>
        </section>
        <section aria-label="Social links" className="flex flex-col gap-4 rounded-card border bg-surface p-5">
          <h2 className="font-sans text-base font-semibold tracking-normal">Social links</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Shown in your store footer and on your About page.</p>
          {SOCIALS.map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <Label htmlFor={`so-${k}`}>{label}</Label>
              <Input id={`so-${k}`} type="url" placeholder="https://" value={d.socials[k] ?? ""} onChange={(e) => setDraft({ ...d, socials: { ...d.socials, [k]: e.target.value || undefined } })} />
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
