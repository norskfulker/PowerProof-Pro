"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { CopyField } from "@/components/pp/copy-field";
import { SaveBar } from "@/components/save/save-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { checkSubdomain, setSubdomain, SUBDOMAIN_ROOT } from "@/lib/api";
import type { StoreDomains } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The free yourname.powerproof.store address, editable with a live availability check. */
export function SubdomainCard({ storeId, domains, onChange }: { storeId: string; domains: StoreDomains; onChange: (d: StoreDomains) => void }) {
  const [value, setValue] = useState(domains.subdomain);
  const [check, setCheck] = useState<{ name: string; ok: boolean; message: string }>();
  const name = value.trim().toLowerCase();
  const checking = name !== domains.subdomain && check?.name !== name;

  useEffect(() => {
    if (name === domains.subdomain) return;
    const t = setTimeout(async () => setCheck({ name, ...(await checkSubdomain(storeId, name)) }), 350);
    return () => clearTimeout(t);
  }, [name, storeId, domains.subdomain]);

  const bar = useDirtyForm({
    value: name,
    saved: domains.subdomain,
    validate: () => !checking && (check?.name !== name || check.ok),
    onSave: async (n) => onChange(await setSubdomain(storeId, n)),
    onDiscard: () => setValue(domains.subdomain),
    savedMessage: `Your store now opens at ${name}.${SUBDOMAIN_ROOT}`,
  });
  const result = name !== domains.subdomain && check?.name === name ? check : undefined;

  return (
    <section aria-labelledby="sub-h" className="flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="sub-h" className="flex-1 font-sans text-base font-semibold tracking-normal">Free address</h2>
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">Always on</span>
      </div>
      <SaveBar state={bar} className="md:ml-auto md:w-fit" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sub-name">Your PowerProof address</Label>
        <div className="flex items-stretch overflow-hidden rounded-control border border-input bg-surface focus-within:border-primary focus-within:outline-2 focus-within:outline-primary">
          <Input id="sub-name" value={value} onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))} className="h-11 min-w-[8rem] flex-1 rounded-none border-0 font-mono focus-visible:outline-none" autoCapitalize="none" spellCheck={false} aria-describedby="sub-h-msg" />
          <span className="flex min-w-0 shrink items-center truncate border-l bg-surface-sunken px-3 font-mono text-[0.8125rem] whitespace-nowrap text-muted-foreground [overflow-wrap:normal]">.{SUBDOMAIN_ROOT}</span>
        </div>
        <p id="sub-h-msg" aria-live="polite" className={cn("flex items-center gap-1.5 text-sm", result ? (result.ok ? "text-success" : "font-medium text-danger") : "text-muted-foreground")}>
          {checking ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking…
            </>
          ) : result ? (
            <>
              {result.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />} {result.message}
            </>
          ) : (
            "Works on every plan, with SSL. Change it any time; the old address redirects for 90 days."
          )}
        </p>
      </div>
      <CopyField value={`https://${domains.subdomain}.${SUBDOMAIN_ROOT}`} display={`${domains.subdomain}.${SUBDOMAIN_ROOT}`} label="Current address" />
    </section>
  );
}
