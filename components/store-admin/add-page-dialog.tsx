"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { createVisualPage, getPageTemplates } from "@/lib/api";
import { TemplateThumb } from "@/components/page-builder/template-thumb";
import { useSetupMode } from "./use-setup-mode";

export const editPageHref = (id: string, ai?: boolean) => `/store/current/design/pages/${id}/edit${ai ? "?ai=1" : ""}`;

/** Ready-made pages a store doesn't have yet: one click makes them */
export const PAGE_STARTERS = [
  { template: "launch", title: "Launch page", body: "One product, front and centre, with a clear buy button." },
  { template: "sale", title: "Sale page", body: "A countdown, the products on offer, and one strong button." },
  { template: "bio", title: "Link in bio", body: "A tidy, phone-first list of your best links." },
  // Pages that gather people rather than sell: each is ready to publish in a minute. Sign-ups land in Sales › Leads.
  { template: "lead", title: "Lead generation", body: "Offer something free for a name and email." },
  { template: "squeeze", title: "Squeeze page", body: "One promise, one form, no menu or footer." },
  { template: "booking", title: "Book a call", body: "An instant calendar: visitors pick a free time." },
  { template: "clickthrough", title: "Click-through page", body: "A short pitch, then one button to the offer." },
];

/**
 * Makes a page and opens it in the store editor, built with AI (the AI brief opens) or by hand.
 * It starts on the store's own way; until the store first opens, the way picked here becomes the
 * store's way. `beforeLeave` saves the page being edited first.
 */
export function AddPageDialog({ open, onOpenChange, beforeLeave }: { open: boolean; onOpenChange: (o: boolean) => void; beforeLeave?: () => Promise<void> }) {
  const router = useRouter();
  const templates = getPageTemplates();
  const [template, setTemplate] = useState(templates[0].id);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const setup = useSetupMode();
  const [picked, setPicked] = useState<boolean>();
  const withAi = picked ?? setup.mode !== "manual";

  async function create() {
    if (title.trim().length < 2) return setTitleError("Give the page a name.");
    setBusy(true);
    try {
      const p = await createVisualPage({ templateId: template, title });
      await setup.remember(withAi ? "ai" : "manual");
      await beforeLeave?.();
      router.push(editPageHref(p.id, withAi));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add page</DialogTitle>
          <DialogDescription>Pick a ready-made page. It opens on its own gradient, laid out in your site&apos;s style, and every block can be changed.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-title">Page name</Label>
          <Input id="np-title" value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(undefined); }} placeholder="Diwali sale" aria-invalid={!!titleError || undefined} aria-describedby={titleError ? "np-title-err" : undefined} />
          {titleError && <p id="np-title-err" className="text-sm font-medium text-danger">{titleError}</p>}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Start from</legend>
          {/* Ready-made pages, each on its own gradient, drawn the way they're laid out */}
          <RadioGroup value={template} onValueChange={setTemplate} aria-label="Template" className="grid max-h-[46vh] grid-cols-2 gap-3 overflow-y-auto p-0.5 sm:grid-cols-3">
            {templates.map((t) => (
              <label
                key={t.id}
                htmlFor={`tpl-${t.id}`}
                className="group flex cursor-pointer flex-col gap-2 rounded-card border bg-surface p-2 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-lift has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary/30 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
              >
                <TemplateThumb template={t.id} />
                <span className="flex items-start gap-2 px-1 pb-1">
                  <RadioGroupItem id={`tpl-${t.id}`} value={t.id} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </fieldset>
        <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4 rounded-control border bg-primary-soft/50 p-3 text-sm">
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 font-semibold"><Sparkles className="size-4 text-primary" aria-hidden /> Build it with AI</span>
            <span className="text-xs text-muted-foreground">Describe the page in a few lines and AI writes every section of this type from your products. You review it before anything goes live.{!setup.open && setup.ready ? " Until your store opens, this also sets how you build your store." : ""}</span>
          </span>
          <Switch checked={withAi} onCheckedChange={setPicked} aria-label="Build it with AI" />
        </label>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />} {withAi ? "Create and describe it" : "Create and edit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
