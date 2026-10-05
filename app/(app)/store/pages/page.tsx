"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { useApi } from "@/hooks/use-api";
import { getStore, getStoreDesign, getStorePages, updateStoreDesign, updateStorePages } from "@/lib/api";
import { uid } from "@/lib/uid";
import type { StoreDesign, StorePages } from "@/lib/types";

const POLICY_TABS = [["refund", "Refund"], ["terms", "Terms"], ["privacy", "Privacy"]] as const;

function defaultPolicy(kind: "refund" | "terms" | "privacy", name: string, email: string, days: number): string {
  if (kind === "refund") return `If a file doesn't open, or the product isn't what the page described, write to ${email} within ${days} days of buying. We'll fix it or refund you in full.`;
  if (kind === "terms") return `When you buy from ${name} you get a personal licence to use the files for yourself or your own projects. You can't resell, share or redistribute them.`;
  return `${name} uses your name, email and phone only to deliver your order and answer your questions. Payment details go straight to the payment gateway.`;
}

export default function StorePagesEditor() {
  const pages = useApi(getStorePages, []);
  const design = useApi(getStoreDesign, []);
  const store = useApi(getStore, []);
  const [draft, setDraft] = useState<StorePages>();
  const [about, setAbout] = useState<StoreDesign["about"]>();
  const [saving, setSaving] = useState(false);

  if (pages.error || design.error) return <ErrorState message={pages.error ?? design.error} onRetry={() => { pages.reload(); design.reload(); }} />;
  if (!pages.data || !design.data || !store.data) return <Skeleton className="h-[600px] rounded-card" />;
  const p = draft ?? pages.data;
  const a = about ?? design.data.about;
  const dirty = !!draft || !!about;
  const setFaq = (faq: StorePages["faq"]) => setDraft({ ...p, faq });

  async function save() {
    setSaving(true);
    try {
      if (draft) pages.setData(await updateStorePages(draft));
      if (about) design.setData(await updateStoreDesign({ ...design.data!, about }));
      setDraft(undefined);
      setAbout(undefined);
      toast.success("Pages saved");
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Store pages"
        description="About, FAQ and the policies every buyer can read. Sensible defaults are filled in; make them sound like you."
        actions={<Button onClick={save} disabled={!dirty || saving}>{saving && <Loader2 className="animate-spin" aria-hidden />}{dirty ? "Save" : "Saved"}</Button>}
      />
      <Tabs defaultValue="about">
        <TabsList><TabsTrigger value="about">About</TabsTrigger><TabsTrigger value="faq">FAQ ({p.faq.length})</TabsTrigger><TabsTrigger value="policies">Policies</TabsTrigger><TabsTrigger value="contact">Contact</TabsTrigger></TabsList>
        <TabsContent value="about" className="mt-4 flex max-w-2xl flex-col gap-4 rounded-card border bg-surface p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><Label htmlFor="ab-n">Name</Label><Input id="ab-n" value={a.name} onChange={(e) => setAbout({ ...a, name: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="ab-l">Based in</Label><Input id="ab-l" value={a.location} onChange={(e) => setAbout({ ...a, location: e.target.value })} /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="ab-s">Your story</Label><Textarea id="ab-s" rows={8} value={a.story} onChange={(e) => setAbout({ ...a, story: e.target.value })} /></div>
        </TabsContent>
        <TabsContent value="faq" className="mt-4 flex max-w-3xl flex-col gap-3">
          {p.faq.map((f, i) => (
            <div key={f.id} className="flex flex-col gap-2 rounded-card border bg-surface p-4">
              <div className="flex items-center gap-1">
                <Label htmlFor={`fq-${f.id}`} className="flex-1">Question {i + 1}</Label>
                <Button variant="ghost" size="icon-sm" disabled={i === 0} aria-label="Move up" onClick={() => { const n = [...p.faq]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setFaq(n); }}><ArrowUp /></Button>
                <Button variant="ghost" size="icon-sm" disabled={i === p.faq.length - 1} aria-label="Move down" onClick={() => { const n = [...p.faq]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setFaq(n); }}><ArrowDown /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Remove question" onClick={() => setFaq(p.faq.filter((x) => x.id !== f.id))}><Trash2 /></Button>
              </div>
              <Input id={`fq-${f.id}`} value={f.q} onChange={(e) => setFaq(p.faq.map((x) => (x.id === f.id ? { ...x, q: e.target.value } : x)))} />
              <Label htmlFor={`fa-${f.id}`} className="sr-only">Answer {i + 1}</Label>
              <Textarea id={`fa-${f.id}`} rows={2} value={f.a} onChange={(e) => setFaq(p.faq.map((x) => (x.id === f.id ? { ...x, a: e.target.value } : x)))} />
            </div>
          ))}
          <Button variant="secondary" className="self-start" onClick={() => setFaq([...p.faq, { id: uid("f"), q: "New question", a: "The answer." }])}><Plus aria-hidden /> Add a question</Button>
        </TabsContent>
        <TabsContent value="policies" className="mt-4 flex max-w-3xl flex-col gap-4">
          {POLICY_TABS.map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1.5 rounded-card border bg-surface p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor={`pol-${k}`}>{label} policy</Label>
                <Button variant="ghost" size="sm" onClick={() => setDraft({ ...p, [k]: defaultPolicy(k, store.data!.name, store.data!.supportEmail, store.data!.refundDays) })}><RotateCcw aria-hidden /> Reset to default</Button>
              </div>
              <Textarea id={`pol-${k}`} rows={6} value={p[k]} onChange={(e) => setDraft({ ...p, [k]: e.target.value })} />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="contact" className="mt-4 flex max-w-2xl flex-col gap-1.5 rounded-card border bg-surface p-5">
          <Label htmlFor="ct">Line shown on your contact page</Label>
          <Input id="ct" value={p.contactNote} onChange={(e) => setDraft({ ...p, contactNote: e.target.value })} />
          <p className="text-sm text-muted-foreground">Messages go to {store.data.supportEmail}. Change it in Settings › Store branding.</p>
        </TabsContent>
      </Tabs>
    </>
  );
}
