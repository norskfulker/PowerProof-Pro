"use client";

import { useState } from "react";
import { Copy, KeyRound, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { BLOCKER_TEXT, cancelStoreClaim, getStoreClaim, sendStoreClaim } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Hand a store to someone by email. `transfer`: the owner gives their store away (and may stay on as
 * an admin). `claim`: PowerProof staff send a store they built to its real owner. Shows the open
 * link if there is one. The link itself is shown once, right after sending.
 */
export function StoreHandover({ storeId, storeName, mode }: { storeId: string; storeName: string; mode: "transfer" | "claim" }) {
  const claim = useApi(() => getStoreClaim(storeId), [storeId], { live: true });
  const [email, setEmail] = useState("");
  const [keep, setKeep] = useState(true);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState<{ link: string; emailed: boolean; blocker?: keyof typeof BLOCKER_TEXT }>();
  const [busy, setBusy] = useState(false);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const send = async () => {
    const out = await sendStoreClaim({ storeId, email: email.trim(), keepPrevious: mode === "transfer" && keep, note: note.trim() || undefined });
    setSent(out);
    setEmail("");
    setNote("");
    claim.reload();
    toast.success(out.emailed ? `Sent to ${email.trim()}` : "Link ready to share", { description: out.emailed ? "The link works for 14 days." : "Email isn't connected here, so copy the link and send it yourself." });
  };

  if (claim.data === undefined && !claim.error) return <Skeleton className="h-28 rounded-card" />;
  const open = claim.data;

  return (
    <div className="flex flex-col gap-4">
      {sent && (
        <div className="flex flex-col gap-2 rounded-card border border-primary/30 bg-primary-soft p-4">
          <Label htmlFor="claim-link">{sent.emailed ? "Sent. You can also share this link:" : "Share this link with them:"}</Label>
          <div className="flex gap-2">
            <Input id="claim-link" readOnly value={sent.link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(sent.link).then(() => toast.success("Link copied"), () => undefined)}><Copy aria-hidden /> Copy</Button>
          </div>
          {sent.blocker && <p className="text-sm text-warning-ink">They can&apos;t accept yet: {BLOCKER_TEXT[sent.blocker]}</p>}
        </div>
      )}

      {open ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border p-4">
          <KeyRound className="size-5 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            Waiting for <strong>{open.email}</strong> to accept. The link works until {formatDate(open.expiresAt)}.
            {open.kind === "transfer" && open.keepPrevious && " You'll stay on as an admin."}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await cancelStoreClaim(open.id);
                setSent(undefined);
                claim.reload();
                toast.success("Link cancelled", { description: "It no longer works." });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />} Cancel link
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) setAsking(true);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`handover-${mode}`}>{mode === "transfer" ? "New owner's email" : "Store owner's email"}</Label>
            <Input id={`handover-${mode}`} type="email" autoComplete="off" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "transfer" ? (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={keep} onCheckedChange={(v) => setKeep(v === true)} className="mt-0.5" />
              <span><span className="font-medium">Keep me on as an admin</span><span className="block text-muted-foreground">You can still help run the store, without payouts or billing.</span></span>
            </label>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="handover-note">Note for them <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="handover-note" rows={2} maxLength={280} placeholder="We built this from your Etsy shop. Everything's ready to go." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          <Button type="submit" variant={mode === "transfer" ? "secondary" : "default"} className="self-start" disabled={!valid}>
            <Send aria-hidden /> {mode === "transfer" ? "Send transfer link" : "Send claim link"}
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={mode === "transfer" ? `Transfer ${storeName}?` : `Send ${storeName} to ${email.trim()}?`}
        description={
          mode === "transfer"
            ? `${email.trim()} gets a link. When they accept, they own ${storeName}: its products, pages, orders, customers and address. Business details and payouts start fresh in their name. ${keep ? "You stay on as an admin." : "You lose access."} Until then, you can cancel the link.`
            : `${email.trim()} gets a link to claim ${storeName}. When they accept, it's theirs and PowerProof's access ends.`
        }
        confirmLabel={mode === "transfer" ? "Send transfer link" : "Send claim link"}
        onConfirm={async () => {
          try {
            await send();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
          }
        }}
      />
    </div>
  );
}
