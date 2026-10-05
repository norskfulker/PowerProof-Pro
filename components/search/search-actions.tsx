"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { copyText } from "@/components/pp/copy-field";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { revealContact, runQuickAction } from "@/lib/api";
import type { QuickAction, SearchResult } from "@/lib/types";

type Destructive = Exclude<QuickAction, "open" | "copy">;

const CONFIRM: Record<Destructive, { title: (r: SearchResult) => string; body: string; label: string; reasonLabel: string }> = {
  refund: { title: (r) => `Refund ${r.title.replace(/^Refund · /, "")}?`, body: "The buyer gets their money back and loses access to the files. The creator's balance goes down by the same amount.", label: "Refund order", reasonLabel: "Reason (shown on the order)" },
  hide_review: { title: (r) => `Hide “${r.title}”?`, body: "The review disappears from the store. The creator can see it in their inbox.", label: "Hide review", reasonLabel: "Reason (for the audit log)" },
  suspend_store: { title: (r) => `Suspend ${r.storeName ?? r.title}?`, body: "The store goes offline and checkout stops. Buyers keep access to what they bought.", label: "Suspend store", reasonLabel: "Reason (for the audit log)" },
};

export const contactKey = (r: SearchResult, field: "email" | "phone") => `${r.type}:${r.id}:${field}`;

/**
 * Quick actions for search results, shared by the palette and the /admin/search page.
 * Destructive actions always confirm; reveals ask for an optional reason. Both are audited.
 */
export function useSearchActions(onChanged?: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState<{ action: Destructive; result: SearchResult }>();
  const [reveal, setReveal] = useState<{ result: SearchResult; field: "email" | "phone" }>();
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  function run(action: QuickAction, result: SearchResult) {
    if (action === "open") return router.push(result.href);
    if (action === "copy") return void copyText(result.id, `Copied ${result.id}`);
    setReason("");
    setPending({ action, result });
  }

  function askReveal(result: SearchResult, field: "email" | "phone") {
    setReason("");
    setReveal({ result, field });
  }

  const dialogs = (
    <>
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(undefined)}
          title={CONFIRM[pending.action].title(pending.result)}
          description={CONFIRM[pending.action].body}
          confirmLabel={CONFIRM[pending.action].label}
          onConfirm={async () => {
            try {
              await runQuickAction(pending.action, pending.result.type, pending.result.id, reason);
              toast.success("Done. It's in the audit log.");
              onChanged?.();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
              throw e;
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-reason">{CONFIRM[pending.action].reasonLabel}</Label>
            <Textarea id="qa-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </ConfirmDialog>
      )}
      {reveal && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setReveal(undefined)}
          title={`Show this ${reveal.field === "email" ? "email" : "phone number"}?`}
          description="Revealing contact details is recorded in the audit log with your name and the reason."
          confirmLabel="Reveal"
          onConfirm={async () => {
            const value = await revealContact(reveal.result.type, reveal.result.id, reveal.field, reason);
            setRevealed((r) => ({ ...r, [contactKey(reveal.result, reveal.field)]: value }));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rv-reason">Why do you need it? (optional)</Label>
            <Textarea id="rv-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Buyer asked for a resend" />
          </div>
        </ConfirmDialog>
      )}
    </>
  );

  return { run, askReveal, revealed, dialogs };
}
