"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyField } from "@/components/pp/copy-field";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getStore } from "@/lib/api";
import { SITE_URL } from "@/lib/format";

export default function StoreDomainPage() {
  const store = useApi(getStore, []);
  const link = store.data ? `${SITE_URL}/${store.data.slug}` : "";
  return (
    <>
      <PageHeader title="Domain" description="Where buyers find your store." />
      <div className="grid max-w-3xl grid-cols-1 gap-6">
        <section aria-label="Your store link" className="flex flex-col gap-3 rounded-card border bg-surface p-5">
          <h2 className="font-sans text-base font-semibold tracking-normal">Your store link</h2>
          {link && <CopyField value={`https://${link}`} display={link} />}
          <p className="text-sm text-muted-foreground">Change the part after the slash in Settings › Store branding. Old links redirect for 90 days.</p>
        </section>
        <section aria-label="Custom domain" className="flex flex-col gap-4 rounded-card border border-dashed border-border-strong bg-surface-sunken p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-control bg-accent-soft text-accent-ink"><Globe className="size-5" aria-hidden /></span>
            <h2 className="flex-1 font-sans text-base font-semibold tracking-normal">Custom domain</h2>
            <StatusPill status="coming_soon" />
          </div>
          <p className="text-sm text-muted-foreground">Use your own address, like shop.yourname.in. We&apos;ll handle the certificate. Leave your email below and we&apos;ll tell you when it&apos;s ready.</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dom">Domain</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="dom" placeholder="shop.yourname.in" disabled aria-describedby="dom-h" />
              <Button disabled>Connect</Button>
            </div>
            <p id="dom-h" className="text-xs text-muted-foreground">Coming soon. Your store works at {link || "your PowerProof link"} until then.</p>
          </div>
        </section>
      </div>
    </>
  );
}
