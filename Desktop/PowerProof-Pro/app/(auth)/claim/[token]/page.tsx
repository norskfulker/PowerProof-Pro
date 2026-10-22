"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { acceptClaim, BLOCKER_TEXT, getClaimInfo, logout, type ClaimInfo } from "@/lib/api";
import { sb } from "@/lib/supabase/browser";

type State = { s: "loading" } | { s: "missing" } | { s: "ready"; info: ClaimInfo; signedInAs: string | null };

/**
 * The link from a store transfer or claim. Says which store and who sent it before anyone signs
 * in; taking it over needs the account with that email (the database checks it, and that the
 * store's money is settled).
 */
export default function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [state, setState] = useState<State>({ s: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const here = `/claim/${token}`;

  useEffect(() => {
    let live = true;
    (async () => {
      const [info, session] = await Promise.all([getClaimInfo(token).catch(() => null), sb().auth.getSession()]);
      if (!live) return;
      if (!info) return setState({ s: "missing" });
      setState({ s: "ready", info, signedInAs: session.data.session?.user.email?.toLowerCase() ?? null });
    })();
    return () => {
      live = false;
    };
  }, [token]);

  if (state.s === "loading") return <Skeleton className="h-80 rounded-dialog" />;
  if (state.s === "missing") {
    return (
      <AuthCard title="This link isn't valid" description="It was already used, cancelled, or replaced by a newer one. Ask whoever sent it for a new link.">
        <Button asChild variant="secondary"><Link href="/dashboard">Go to PowerProof</Link></Button>
      </AuthCard>
    );
  }

  const { info, signedInAs } = state;
  const title = info.kind === "claim" ? `Claim ${info.storeName}` : `Take over ${info.storeName}`;
  const description =
    info.kind === "claim" ? (
      <>PowerProof set up <strong className="text-foreground">{info.storeName}</strong> for <strong className="text-foreground">{info.email}</strong>{info.products ? `, with ${info.products} product${info.products === 1 ? "" : "s"} ready` : ""}. Claim it to make it yours.</>
    ) : (
      <>{info.from} is handing <strong className="text-foreground">{info.storeName}</strong> to <strong className="text-foreground">{info.email}</strong>. You&apos;d become its owner{info.keepPrevious ? `, and ${info.from} stays on as an admin` : ""}.</>
    );
  const summary = (
    <div className="mb-5 flex items-center gap-3 rounded-card border bg-surface-sunken p-3">
      {info.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.logo} alt="" className="size-11 rounded-[10px] object-cover" />
      ) : (
        <span className="grid size-11 place-items-center rounded-[10px] font-mono text-sm font-semibold text-white" style={{ background: info.brandColor ?? "#0F3D33" }}>{info.storeName.slice(0, 2).toUpperCase()}</span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-semibold">{info.storeName}</span>
        <span className="block text-xs text-muted-foreground">{info.products} product{info.products === 1 ? "" : "s"} · products, pages, orders and its address move with it</span>
      </span>
    </div>
  );
  const note = info.note ? <p className="mb-4 border-l-2 pl-3 text-sm text-muted-foreground">{info.note}</p> : null;

  if (info.expired) {
    return (
      <AuthCard title="This link has expired" description={`Links work for 14 days. Ask ${info.from === "PowerProof" ? "PowerProof support" : info.from} for a new one.`}>
        <Button asChild variant="secondary"><Link href="/dashboard">Go to PowerProof</Link></Button>
      </AuthCard>
    );
  }

  if (!signedInAs) {
    return (
      <AuthCard title={title} description={description}>
        {summary}
        {note}
        <div className="flex flex-col gap-3">
          <Button asChild size="lg"><Link href={`/signup?next=${encodeURIComponent(here)}&email=${encodeURIComponent(info.email)}`}>Create a free account</Link></Button>
          <Button asChild size="lg" variant="secondary"><Link href={`/login?next=${encodeURIComponent(here)}`}>I already have an account</Link></Button>
          <p className="text-xs text-muted-foreground">Use {info.email}: the link only works for that address.</p>
        </div>
      </AuthCard>
    );
  }

  if (signedInAs !== info.email.toLowerCase()) {
    return (
      <AuthCard title={title} description={description}>
        {summary}
        <div className="flex flex-col gap-3">
          <p className="rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm">You&apos;re logged in as <strong>{signedInAs}</strong>. This store is for <strong>{info.email}</strong>.</p>
          <Button
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await logout().catch(() => undefined);
              router.replace(`/login?next=${encodeURIComponent(here)}`);
              router.refresh();
            }}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />} Log out and switch account
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={title} description={description}>
      {summary}
      {note}
      <div className="flex flex-col gap-3">
        {info.blocker && <p role="status" className="rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm">Not quite yet: {BLOCKER_TEXT[info.blocker]} {info.from === "PowerProof" ? "PowerProof" : info.from} has to do this.</p>}
        <FormError message={error} />
        <Button
          size="lg"
          disabled={busy || !!info.blocker}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await acceptClaim(token);
              toast.success(`${info.storeName} is yours`, { description: "Add your business and payout details in Settings." });
              router.replace("/settings/company");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "That didn't work. Try again.");
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />} {info.kind === "claim" ? "Claim the store" : "Accept the store"}
        </Button>
        <p className="text-xs text-muted-foreground">Your own stores, if you have any, stay yours. Business details (GSTIN, PAN, legal name) and payouts start fresh in your name.</p>
      </div>
    </AuthCard>
  );
}
