"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { emailCustomers } from "@/lib/api";
import type { Customer } from "@/lib/types";

/**
 * Write one email and send it from the store. To one customer it's a direct message; to several
 * it only reaches those who asked for the store's emails at checkout. Replies go to the store's
 * support email, and every email has an unsubscribe link. Mount with a new key each time it opens.
 */
export function EmailComposer({ customers, open, onOpenChange }: { customers: Customer[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const one = customers.length === 1;
  const reach = customers.filter((c) => !c.unsubscribed && (one || c.subscribed));

  async function send() {
    setBusy(true);
    try {
      const r = await emailCustomers({ emails: reach.map((c) => c.email), subject, body });
      toast.success(one ? `Sent to ${customers[0].name}` : `Sent to ${r.sent} customer${r.sent === 1 ? "" : "s"}`, { description: r.skipped ? `${r.skipped} skipped: they didn't ask for your emails or unsubscribed.` : undefined });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The email didn't go out.");
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{one ? `Email ${customers[0]?.name ?? ""}` : "Email customers"}</SheetTitle>
          <SheetDescription>
            {one
              ? customers[0]?.unsubscribed
                ? "They unsubscribed from your emails, so this can't be sent."
                : `To ${customers[0]?.email}. Replies come to your support email.`
              : `Goes to ${reach.length} of ${customers.length}: only customers who asked for your emails at checkout and haven't unsubscribed.`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-subject">Subject</Label>
            <Input id="mail-subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={one ? "About your order" : "New this week"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-body">Message</Label>
            <Textarea id="mail-body" size="lg" maxLength={10_000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write it like you'd talk to them. A blank line starts a new paragraph." />
          </div>
          <p className="text-xs text-muted-foreground">Sent from your store&apos;s name, with a button to your store and an unsubscribe link.{!one && " Up to 3 group emails a day."}</p>
        </div>
        <SheetFooter>
          <Button onClick={() => void send()} disabled={busy || !reach.length || subject.trim().length < 2 || body.trim().length < 5}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} {one ? "Send" : `Send to ${reach.length}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
