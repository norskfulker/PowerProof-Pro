"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/pp/segmented";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { QuestionThread } from "@/components/pp/question-thread";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { answerQuestion, getQuestionsInbox, reportQuestion, setQuestionHidden } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function QuestionsInboxPage() {
  const { data, loading, error, reload, setData } = useApi(getQuestionsInbox, [], { live: true });
  const store = useCurrentStore();
  const [filter, setFilter] = useState<"open" | "answered" | "hidden">("open");

  const list = useMemo(() => (data ?? []).filter((q) =>
    filter === "hidden" ? q.hidden : !q.hidden && (filter === "open" ? q.answers.length === 0 : q.answers.length > 0)
  ), [data, filter]);
  const openCount = data?.filter((q) => !q.hidden && q.answers.length === 0).length ?? 0;

  return (
    <>
      <PageHeader title="Questions" description="Asked on your product pages. Answers show to everyone and the asker gets an email. Verified buyers can answer too." />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96 rounded-card" /> : data && data.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No questions yet." body="When someone asks about a product, it lands here." action={<Button asChild variant="secondary"><Link href="/catalog/products">See your products</Link></Button>} />
      ) : data && (
        <div className="flex flex-col gap-4">
          <Segmented label="Filter questions" value={filter} onChange={setFilter} options={[{ value: "open", label: `Waiting (${openCount})` }, { value: "answered", label: "Answered" }, { value: "hidden", label: "Hidden" }]} />
          {list.length === 0 ? (
            <p className="rounded-card border bg-surface py-10 text-center text-sm text-muted-foreground">{filter === "open" ? "All caught up. Nice." : "Nothing here."}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((q) => (
                <li key={q.id} className={cn("rounded-card border bg-surface px-5", q.hidden && "opacity-70")}>
                  <p className="pt-4 text-sm text-muted-foreground">
                    On <Link href={`/s/${store.data?.slug}/${q.productSlug}#questions`} target="_blank" className="font-medium text-foreground hover:underline">{q.productTitle}</Link> · {q.askerEmail}
                    {q.reported && <span className="ml-2 font-semibold text-warning-ink">Reported</span>}
                  </p>
                  <QuestionThread
                    question={q}
                    answerLabel={q.answers.length ? "Add an answer" : "Answer"}
                    onAnswer={async (body) => {
                      const out = await answerQuestion(q.id, body);
                      setData(data.map((x) => (x.id === q.id ? { ...x, ...out } : x)));
                      toast.success("Answered", { description: `${q.asker} gets an email.` });
                    }}
                    onReport={q.reported ? undefined : async () => { await reportQuestion(q.id); setData(data.map((x) => (x.id === q.id ? { ...x, reported: true } : x))); }}
                  />
                  <div className="border-t py-2">
                    <Button variant="ghost" size="sm" onClick={async () => {
                      const out = await setQuestionHidden(q.id, !q.hidden);
                      setData(data.map((x) => (x.id === q.id ? { ...x, ...out } : x)));
                      toast.success(out.hidden ? "Hidden from your store" : "Visible again");
                    }}>
                      {q.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />} {q.hidden ? "Unhide" : "Hide"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
