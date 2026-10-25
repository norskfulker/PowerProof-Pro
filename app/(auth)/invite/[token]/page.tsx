"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { acceptInvite, getInviteInfo, logout, type InviteInfo } from "@/lib/api";
import { sb } from "@/lib/supabase/browser";
import { areaLabels } from "@/lib/team";

type State = { s: "loading" } | { s: "missing" } | { s: "ready"; info: InviteInfo; signedInAs: string | null };

/**
 * The link from a team invite. Says which workspace and what access before anyone signs in; joining
 * needs the account with the invited email (the database checks it).
 */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [state, setState] = useState<State>({ s: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const here = `/invite/${token}`;

  useEffect(() => {
    let live = true;
    (async () => {
      const [info, session] = await Promise.all([getInviteInfo(token).catch(() => null), sb().auth.getSession()]);
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
      <AuthCard title="This invite isn't valid" description="It was already used, cancelled, or replaced by a newer link. Ask the workspace owner to send a new one.">
        <Button asChild variant="secondary"><Link href="/dashboard">Go to PowerProof</Link></Button>
      </AuthCard>
    );
  }

  const { info, signedInAs } = state;
  const what = info.role === "admin" ? "everything except payouts and billing" : areaLabels(info.areas).join(", ").toLowerCase();
  const title = `Join ${info.workspaceName}`;
  const description = <>{info.inviter} invited <strong className="text-foreground">{info.email}</strong> to the {info.workspaceName} workspace on PowerProof, with access to {what} in {info.stores === 1 ? "its store" : `all ${info.stores} of its stores`}.</>;

  if (info.expired) {
    return (
      <AuthCard title="This invite has expired" description={`Invites work for 7 days. Ask ${info.inviter} to send a new one from Settings › Team.`}>
        <Button asChild variant="secondary"><Link href="/dashboard">Go to PowerProof</Link></Button>
      </AuthCard>
    );
  }

  if (!signedInAs) {
    return (
      <AuthCard title={title} description={description}>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg"><Link href={`/signup?next=${encodeURIComponent(here)}&email=${encodeURIComponent(info.email)}`}>Create a free account</Link></Button>
          <Button asChild size="lg" variant="secondary"><Link href={`/login?next=${encodeURIComponent(here)}`}>I already have an account</Link></Button>
          <p className="text-xs text-muted-foreground">Use {info.email}: the invite only works for that address.</p>
        </div>
      </AuthCard>
    );
  }

  if (signedInAs !== info.email.toLowerCase()) {
    return (
      <AuthCard title={title} description={description}>
        <div className="flex flex-col gap-3">
          <p className="rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm">You&apos;re logged in as <strong>{signedInAs}</strong>. This invite is for <strong>{info.email}</strong>.</p>
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
      <div className="flex flex-col gap-3">
        <FormError message={error} />
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await acceptInvite(token);
              toast.success(`You joined ${info.workspaceName}`);
              // The app opens on the workspace's first store (it's now the active one)
              router.replace("/dashboard");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "That didn't work. Try again.");
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Users aria-hidden />} Join the team
        </Button>
        <p className="text-xs text-muted-foreground">Your own workspaces, if you have any, stay yours. Switch between workspaces and stores from the menu at the top.</p>
      </div>
    </AuthCard>
  );
}
