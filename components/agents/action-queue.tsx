"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Clock, MessageCircle, MessageSquareReply, PhoneCall, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { actOn, getActionItems, type ActionItem } from "@/lib/api/agents";
import { MarkReply } from "./agent-tabs";

const ICON = { whatsapp_send: MessageCircle, needs_personal_call: PhoneCall, approve_draft: CheckCircle2, review_reply: MessageSquareReply } as const;

/**
 * Things that need the owner, one at a time with a big "Do next": WhatsApp opens with the message
 * written, the owner presses send there, comes back and marks it sent. Skip and snooze are one tap.
 */
export function ActionQueue() {
  const { data, loading, error, reload, setData } = useApi(() => getActionItems(), [], { live: true });
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-72 rounded-card" />;
  const [next, ...rest] = data;

  const act = async (item: ActionItem, action: "done" | "skip" | "snooze") => {
    setBusy(true);
    try {
      await actOn(item.id, action, action === "snooze" ? 24 : undefined);
      setData(data.filter((x) => x.id !== item.id));
      setOpened(null);
      toast.success(action === "done" ? "Marked done." : action === "skip" ? "Skipped." : "Snoozed until tomorrow.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageHeader title="Send queue" back={{ href: "/marketplace?tab=subscribed", label: "Subscribed agents" }} />
      {!next ? (
        <EmptyState icon={CheckCircle2} title="All done" body="Nothing needs you right now. New WhatsApp messages and calls show up here." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{data.length} waiting</p>
          <NextItem item={next} opened={opened === next.id} busy={busy} onOpen={() => setOpened(next.id)} onAct={(a) => act(next, a)} />
          {rest.length > 0 && (
            <ul className="flex flex-col divide-y rounded-card border bg-surface">
              {rest.slice(0, 20).map((i) => {
                const Icon = ICON[i.kind];
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate">{i.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function NextItem({ item, opened, busy, onOpen, onAct }: { item: ActionItem; opened: boolean; busy: boolean; onOpen: () => void; onAct: (a: "done" | "skip" | "snooze") => void }) {
  const url = typeof item.payload.url === "string" ? item.payload.url : null;
  const phone = typeof item.payload.phone === "string" ? item.payload.phone : null;
  const reminderId = typeof item.payload.reminderId === "string" ? item.payload.reminderId : null;
  const outboxId = typeof item.payload.outboxId === "string" ? item.payload.outboxId : null;
  const [replying, setReplying] = useState(false);
  const Icon = ICON[item.kind];
  return (
    <section className="flex flex-col gap-4 rounded-card border bg-surface p-5 shadow-card" aria-label="Do next">
      <p className="eyebrow flex items-center gap-1.5">
        <Icon className="size-3.5" aria-hidden /> Do next
      </p>
      <h2 className="text-xl">{item.title}</h2>
      {item.body && <p className="max-h-60 overflow-y-auto rounded-control bg-muted p-3 text-sm whitespace-pre-wrap">{item.body}</p>}
      {item.kind === "whatsapp_send" && url ? (
        opened ? (
          <>
            <p className="text-sm text-muted-foreground">Sent it in WhatsApp?</p>
            <Button size="lg" disabled={busy} onClick={() => onAct("done")}>
              <CheckCircle2 aria-hidden /> Yes, mark it sent
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Open WhatsApp again
              </a>
            </Button>
            {outboxId && (
              <>
                <Button size="lg" variant="ghost" onClick={() => setReplying(true)}>
                  <MessageSquareReply aria-hidden /> They replied
                </Button>
                <MarkReply instanceId={item.instanceId} outboxId={outboxId} open={replying} onOpenChange={setReplying} />
              </>
            )}
          </>
        ) : (
          <Button size="lg" asChild>
            <a href={url} target="_blank" rel="noreferrer" onClick={onOpen}>
              <MessageCircle aria-hidden /> Send next on WhatsApp
            </a>
          </Button>
        )
      ) : item.kind === "needs_personal_call" ? (
        <>
          {phone && (
            <Button size="lg" asChild>
              <a href={`tel:${phone}`}>
                <PhoneCall aria-hidden /> Call now
              </a>
            </Button>
          )}
          <Button size="lg" variant={phone ? "secondary" : "primary"} disabled={busy} onClick={() => onAct("done")}>
            I&apos;ve called them
          </Button>
        </>
      ) : item.kind === "review_reply" ? (
        <Button size="lg" disabled={busy} onClick={() => onAct("done")}>
          <CheckCircle2 aria-hidden /> Got it
        </Button>
      ) : item.kind === "approve_draft" && reminderId ? (
        <Button size="lg" asChild>
          <Link href={`/agents/my/${item.instanceId}/message/${reminderId}`}>Look it over</Link>
        </Button>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => onAct("skip")}>
          <SkipForward aria-hidden /> Skip
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onAct("snooze")}>
          <Clock aria-hidden /> Tomorrow
        </Button>
      </div>
    </section>
  );
}
