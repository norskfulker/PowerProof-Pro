"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { render } from "@react-email/render";
import { Monitor, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { EMAILS } from "@/components/emails/email-registry";
import { useEmailContext } from "@/components/emails/use-email-context";
import { cn } from "@/lib/utils";

function Preview({ slug }: { slug: string }) {
  const def = EMAILS.find((e) => e.slug === slug);
  const params = useSearchParams();
  const { ctx, error, retry } = useEmailContext(params.get("order"));
  const [html, setHtml] = useState<string>();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (!ctx || !def) return;
    let alive = true;
    render(def.render(ctx)).then((h) => alive && setHtml(h));
    return () => {
      alive = false;
    };
    // ctx is rebuilt each render; key on the ids that matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, ctx?.order?.id, ctx?.payout?.id, ctx?.store.name]);

  if (!def) notFound();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Emails" className="flex gap-2 overflow-x-auto lg:flex-col">
        {EMAILS.map((e) => (
          <Link key={e.slug} href={`/emails/${e.slug}`} aria-current={e.slug === slug ? "page" : undefined}
            className={cn("shrink-0 rounded-control px-3 py-2.5 text-sm font-medium", e.slug === slug ? "bg-primary-soft text-primary" : "hover:bg-muted")}>
            {e.name}
          </Link>
        ))}
      </nav>
      <section aria-label={`${def.name} preview`} className="flex flex-col overflow-hidden rounded-card border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate"><span className="text-muted-foreground">Subject:</span> <strong>{ctx ? def.subject(ctx) : "…"}</strong></p>
            <p className="truncate text-muted-foreground">To: {def.to === "Buyer" ? ctx?.order?.buyerEmail : ctx?.store.ownerEmail} · From: {def.to === "Buyer" ? ctx?.store.name : "PowerProof"} &lt;hello@powerproof.store&gt;</p>
          </div>
          <div className="flex gap-1" role="group" aria-label="Preview size">
            <Button size="icon-sm" variant={device === "desktop" ? "secondary" : "ghost"} aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} aria-label="Desktop"><Monitor /></Button>
            <Button size="icon-sm" variant={device === "mobile" ? "secondary" : "ghost"} aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} aria-label="Phone"><Smartphone /></Button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => toast.success("Test email sent", { description: ctx?.store.ownerEmail })}><Send aria-hidden /> Send me a test</Button>
        </div>
        <div className="flex justify-center bg-surface-sunken p-4">
          {error ? (
            <ErrorState message={error} onRetry={retry} className="w-full" />
          ) : html ? (
            <iframe title={`${def.name} email`} srcDoc={html} sandbox="" className={cn("h-[760px] rounded-media border bg-surface transition-[width] duration-200", device === "mobile" ? "w-[375px] max-w-full" : "w-full")} />
          ) : (
            <Skeleton className="h-[760px] w-full" />
          )}
        </div>
      </section>
    </div>
  );
}

export default function EmailPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense>
      <Preview slug={slug} />
    </Suspense>
  );
}
