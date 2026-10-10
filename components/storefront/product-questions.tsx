"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuestionThread } from "@/components/pp/question-thread";
import { askQuestion, reportQuestion } from "@/lib/api";
import type { Question } from "@/lib/types";

/** Questions anyone can ask (name + email, no login). Only the first name is shown. */
export function ProductQuestions({ slug, productId, initial }: { slug: string; productId: string; initial: Question[] }) {
  const [questions, setQuestions] = useState(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", body: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f | "form", string>>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (f.name.trim().length < 2) next.name = "Tell us your name.";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) next.email = "We'll email you the answer. Check the address.";
    if (f.body.trim().length < 8) next.body = "Ask a full question so the creator can help.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const q = await askQuestion(slug, productId, f);
      setQuestions([q, ...questions]);
      setF({ name: "", email: "", body: "" });
      setOpen(false);
      toast.success("Question posted", { description: "We'll email you when it's answered." });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Couldn't post." });
    } finally {
      setPending(false);
    }
  }

  const field = (k: "name" | "email", label: string, type = "text") => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`q-${k}`}>{label}</Label>
      <Input id={`q-${k}`} type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-invalid={!!errors[k] || undefined} aria-describedby={`q-${k}-e`} />
      {errors[k] && <p id={`q-${k}-e`} className="text-sm font-medium text-danger">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {open ? (
        <form noValidate onSubmit={submit} className="flex flex-col gap-3 rounded-card border bg-surface p-5">
          {errors.form && <p role="alert" className="text-sm font-medium text-danger">{errors.form}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("name", "Your name")}
            {field("email", "Email (not shown)", "email")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-body">Your question</Label>
            <Textarea id="q-body" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} aria-invalid={!!errors.body || undefined} aria-describedby="q-body-e" />
            {errors.body && <p id="q-body-e" className="text-sm font-medium text-danger">{errors.body}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Post question</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground">Only your first name is shown. The creator or a verified buyer will answer.</p>
        </form>
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>Ask a question</Button>
      )}
      <div className="rounded-card border bg-surface px-5">
        {questions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No questions yet. Ask the first one.</p>
        ) : (
          questions.map((q) => <QuestionThread key={q.id} question={q} onReport={() => reportQuestion(q.id)} />)
        )}
      </div>
    </div>
  );
}
