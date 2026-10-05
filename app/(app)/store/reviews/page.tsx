"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquareHeart, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/pp/segmented";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { ReviewSummary } from "@/components/pp/review-summary";
import { StarInput } from "@/components/pp/stars";
import { InboxReviewCard } from "@/components/store-admin/review-card";
import { useApi } from "@/hooks/use-api";
import { addImportedReview, getProducts, getReviewsInbox, getStore } from "@/lib/api";
import { ratingSummary } from "@/lib/pricing";
import type { Review } from "@/lib/types";

const FILTERS = [
  ["all", "All"],
  ["reply", "Needs a reply"],
  ["pinned", "Pinned"],
  ["hidden", "Hidden"],
  ["reported", "Reported"],
  ["imported", "Imported"],
] as const;

/** Shown 20 at a time; a store can have thousands of reviews */
const PAGE = 20;

export default function ReviewsInboxPage() {
  const { data, loading, error, reload, setData } = useApi(getReviewsInbox, [], { live: true });
  const store = useApi(getStore, []);
  const products = useApi(() => getProducts({ status: "published" }), []);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [shown, setShown] = useState(PAGE);
  const [importing, setImporting] = useState(false);
  const [imp, setImp] = useState({ productId: "", author: "", rating: 5 as Review["rating"], title: "", body: "" });
  const [impError, setImpError] = useState<string>();
  const [impPending, setImpPending] = useState(false);

  const list = useMemo(() => (data ?? []).filter((r) =>
    filter === "all" ? true : filter === "reply" ? !r.reply && !r.imported : filter === "pinned" ? r.pinned : filter === "hidden" ? r.hidden : filter === "reported" ? r.reported : r.imported
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, filter]);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Only verified buyers can review. You can reply, pin up to 3 and hide spam. You can't change stars or words; that's what makes them worth reading."
        actions={<Button variant="secondary" onClick={() => setImporting(true)}><Plus aria-hidden /> Add imported testimonial</Button>}
      />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96 rounded-card" /> : data && data.length === 0 ? (
        <EmptyState icon={MessageSquareHeart} title="No reviews yet." body="Buyers get a private review link after they buy. The first one tends to arrive within a week." />
      ) : data && (
        <div className="flex flex-col gap-4">
          <ReviewSummary summary={ratingSummary(data)} />
          <Segmented label="Filter reviews" value={filter} onChange={(f) => { setFilter(f); setShown(PAGE); }} options={FILTERS.map(([value, label]) => ({ value, label }))} />
          {list.length === 0 ? <p className="rounded-card border bg-surface py-10 text-center text-sm text-muted-foreground">Nothing here.</p> : (
            <ul className="flex flex-col gap-3">
              {list.slice(0, shown).map((r) => <InboxReviewCard key={r.id} review={r} creatorName={store.data?.ownerName.split(" ")[0] ?? "You"} onChange={(n) => setData(data.map((x) => (x.id === n.id ? n : x)))} />)}
            </ul>
          )}
          {list.length > shown && (
            <div className="flex flex-col items-center gap-1">
              <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>Show more</Button>
              <p className="text-xs text-muted-foreground">Showing {shown.toLocaleString("en-IN")} of {list.length.toLocaleString("en-IN")}</p>
            </div>
          )}
        </div>
      )}

      <Sheet open={importing} onOpenChange={setImporting}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">Imported testimonial</SheetTitle>
            <SheetDescription>From before PowerProof, like a DM or an old platform. It shows with an Imported label and doesn&apos;t count towards your rating.</SheetDescription>
          </SheetHeader>
          <form
            id="imp"
            noValidate
            className="flex flex-col gap-4 px-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!imp.productId) return setImpError("Pick the product it's about.");
              if (imp.author.trim().length < 2) return setImpError("Add the person's name.");
              setImpPending(true);
              try {
                const r = await addImportedReview(imp);
                setData([{ ...r, productTitle: products.data?.find((p) => p.id === r.productId)?.title ?? "" }, ...(data ?? [])]);
                setImporting(false);
                toast.success("Testimonial added");
              } catch (err) {
                setImpError(err instanceof Error ? err.message : "Couldn't add.");
              } finally {
                setImpPending(false);
              }
            }}
          >
            {impError && <p role="alert" className="text-sm font-medium text-danger">{impError}</p>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="imp-p">Product</Label>
              <Select value={imp.productId} onValueChange={(v) => setImp({ ...imp, productId: v })}>
                <SelectTrigger id="imp-p" className="w-full"><SelectValue placeholder="Pick a product" /></SelectTrigger>
                <SelectContent>{products.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="imp-a">Name as it should appear</Label><Input id="imp-a" value={imp.author} onChange={(e) => setImp({ ...imp, author: e.target.value })} placeholder="Rohit M." /></div>
            <fieldset><legend className="mb-1 text-sm font-medium">Rating</legend><StarInput value={imp.rating} onChange={(v) => setImp({ ...imp, rating: v })} /></fieldset>
            <div className="flex flex-col gap-1.5"><Label htmlFor="imp-t">Headline</Label><Input id="imp-t" value={imp.title} onChange={(e) => setImp({ ...imp, title: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="imp-b">What they said</Label><Textarea id="imp-b" rows={4} value={imp.body} onChange={(e) => setImp({ ...imp, body: e.target.value })} /></div>
          </form>
          <SheetFooter><Button type="submit" form="imp" disabled={impPending}>{impPending && <Loader2 className="animate-spin" aria-hidden />} Add testimonial</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
