"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/pp/currency-input";
import type { Announcement, Product, StoreDesign } from "@/lib/types";
import { Segmented } from "@/components/pp/segmented";
import { TargetSelect } from "./target-select";

export function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function AnnouncementEditor({ design, onChange }: { design: StoreDesign; onChange: (d: StoreDesign) => void }) {
  const a = design.announcement;
  const set = (p: Partial<Announcement>) => onChange({ ...design, announcement: { ...a, ...p } });
  return (
    <div className="flex flex-col gap-3">
      <Field id="a-text" label="Text" hint="Use the switch above to show or hide the bar."><Input id="a-text" value={a.text} maxLength={80} onChange={(e) => set({ text: e.target.value })} /></Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="a-code" label="Code (optional)"><Input id="a-code" className="font-mono uppercase" value={a.code ?? ""} onChange={(e) => set({ code: e.target.value.toUpperCase() || undefined })} /></Field>
        <Field id="a-end" label="Countdown to (optional)">
          <Input id="a-end" type="datetime-local" value={toLocal(a.endsAt)} onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5"><span className="text-sm font-medium">Text position</span><Segmented label="Announcement text position" value={a.align ?? "center"} onChange={(align) => set({ align })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></div>
        <div className="flex flex-col gap-1.5"><span className="text-sm font-medium">Colour</span><Segmented label="Announcement colour" value={a.tone ?? "brand"} onChange={(tone) => set({ tone })} options={[{ value: "brand", label: "Brand" }, { value: "dark", label: "Dark" }, { value: "soft", label: "Soft" }]} /></div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
        Scroll the message across the bar
        <Switch checked={!!a.scroll} onCheckedChange={(scroll) => set({ scroll })} aria-label="Scroll the announcement" />
      </label>
      <TargetSelect id="a-target" label="Message links to" value={a.target ?? ""} onChange={(target) => set({ target: target || undefined })} allowNone />
    </div>
  );
}

export function OrderBumpEditor({ design, products, onChange }: { design: StoreDesign; products: Product[]; onChange: (d: StoreDesign) => void }) {
  const live = products.filter((p) => p.status === "published");
  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Offer an add-on at checkout
        <Switch
          checked={!!design.orderBump}
          onCheckedChange={(v) => onChange({ ...design, orderBump: v && live[0] ? { productId: live[0].id, price: { amount: 9900, currency: "INR" }, label: `Add ${live[0].title}` } : undefined })}
          aria-label="Offer an add-on at checkout"
        />
      </label>
      {design.orderBump && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="ob-p" label="Product">
            <Select value={design.orderBump.productId} onValueChange={(v) => onChange({ ...design, orderBump: { ...design.orderBump!, productId: v, label: `Add ${live.find((p) => p.id === v)?.title ?? ""}` } })}>
              <SelectTrigger id="ob-p" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{live.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="ob-price" label="Add-on price">
            <CurrencyInput id="ob-price" value={design.orderBump.price} onChange={(m) => m && onChange({ ...design, orderBump: { ...design.orderBump!, price: m } })} />
          </Field>
        </div>
      )}
    </div>
  );
}
