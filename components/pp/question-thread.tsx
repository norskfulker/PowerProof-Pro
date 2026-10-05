"use client";

import { useState } from "react";
import { Flag, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/format";
import type { Question } from "@/lib/types";

/** A question with one level of answers. Creator answers are labelled. */
export function QuestionThread({
  question,
  onAnswer,
  answerLabel = "Answer",
  onReport,
}: {
  question: Question;
  /** Given only to people allowed to answer (creator, verified buyers). */
  onAnswer?: (body: string) => Promise<void>;
  answerLabel?: string;
  onReport?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [reported, setReported] = useState(false);
  const id = `ans-${question.id}`;

  return (
    <article className="flex flex-col gap-3 border-b py-5 last:border-b-0" aria-label={`Question from ${question.asker}`}>
      <div className="flex gap-3">
        <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{question.body}</p>
          <p className="text-sm text-muted-foreground">{question.asker} · {timeAgo(question.createdAt)}</p>
        </div>
      </div>
      {question.answers.length > 0 ? (
        <ul className="ml-8 flex flex-col gap-3">
          {question.answers.map((a) => (
            <li key={a.id} className="rounded-control bg-surface-sunken px-4 py-3 text-sm">
              <p className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
                {a.author}
                {a.role === "creator" && <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] text-primary-foreground">Creator</span>}
              </p>
              <p className="text-foreground/85">{a.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ml-8 text-sm text-muted-foreground">No answer yet. The creator gets a nudge.</p>
      )}
      <div className="ml-8 flex flex-wrap items-center gap-2">
        {onAnswer && !open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{answerLabel}</Button>
        )}
        {onReport && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={reported}
            onClick={async () => {
              setReported(true);
              await onReport();
              toast.success("Reported", { description: "Thanks. PowerProof will take a look." });
            }}
          >
            <Flag aria-hidden /> {reported ? "Reported" : "Report"}
          </Button>
        )}
      </div>
      {onAnswer && open && (
        <form
          noValidate
          className="ml-8 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (body.trim().length < 3) return setError("Write an answer first.");
            setPending(true);
            try {
              await onAnswer(body.trim());
              setBody("");
              setOpen(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't post your answer.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Label htmlFor={id}>Your answer</Label>
          <Textarea id={id} rows={3} value={body} onChange={(e) => { setBody(e.target.value); setError(undefined); }} aria-invalid={!!error || undefined} aria-describedby={`${id}-e`} />
          {error && <p id={`${id}-e`} className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Post answer</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </article>
  );
}
