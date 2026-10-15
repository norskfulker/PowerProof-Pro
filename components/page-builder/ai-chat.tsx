"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RenderContext } from "@/lib/api";
import { allowanceText, useAiBuild } from "./ai-build-store";
import { useEditorStore } from "./editor-context";
import { cn } from "@/lib/utils";

/** The creator's language: what they chose last time, else their browser's */
export function preferredLanguage(fallback = "English"): string {
  try {
    const saved = localStorage.getItem("pp:ai-language");
    if (saved) return saved;
  } catch {
    /* storage blocked */
  }
  return fallback;
}

/**
 * Chat with the page builder: the creator types what to add or change, AI streams it onto
 * the canvas section by section. Each message is one AI run (one of the free messages).
 * Used in the add-section picker's AI tab; the keep/discard review bar takes over after.
 */
export function AiChat({ pageId, isHome, context, insertIndex, autoFocus }: {
  pageId: string;
  isHome: boolean;
  context: RenderContext;
  /** Sections land here (and after it); undefined appends at the end */
  insertIndex?: number;
  autoFocus?: boolean;
}) {
  const editor = useEditorStore();
  const messages = useAiBuild((s) => s.messages);
  const phase = useAiBuild((s) => s.phase);
  const allowance = useAiBuild((s) => s.allowance);
  const allowanceError = useAiBuild((s) => s.allowanceError);
  const { refreshAllowance, pushUser, start, stop, clearChat } = useAiBuild.getState();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refreshAllowance(context.store.id);
  }, [refreshAllowance, context.store.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, phase]);

  const running = phase.kind === "running";
  const left = allowance ? Math.max(0, allowance.daily - allowance.used) : undefined;
  const blocked = !allowance?.connected || left === 0 || (allowance.freeLeft !== null && allowance.freeLeft <= 0);
  const ready = text.trim().length >= 3 && !running && !blocked;

  async function send() {
    const want = text.trim();
    if (want.length < 3 || running || blocked) return;
    setText("");
    pushUser(want);
    try {
      localStorage.setItem("pp:ai-language", preferredLanguage());
    } catch {
      /* storage blocked */
    }
    await start(
      editor,
      {
        pageType: "blank",
        description: `Add exactly one section to the page from this (don't rebuild anything else, don't repeat sections already there): ${want}`,
        audience: "",
        tone: "friendly",
        language: preferredLanguage(),
        productIds: [],
        theme: false,
        mode: "append",
      },
      { pageId, isHome, slug: context.store.slug, insertIndex, fromChat: true }
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow px-1">AI chat</p>
        {messages.length > 0 && !running && (
          <Button type="button" variant="ghost" size="sm" onClick={clearChat}>
            <Trash2 aria-hidden /> Clear
          </Button>
        )}
      </div>

      <div aria-live="polite" className="flex max-h-72 min-h-32 flex-col gap-2 overflow-y-auto rounded-control border bg-surface-sunken p-3">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 py-6 text-center">
            <Sparkles className="size-5 text-primary" aria-hidden />
            <p className="text-sm font-medium">Describe the section you want</p>
            <p className="text-xs text-muted-foreground">e.g. “A reviews wall with our best ratings” or “A countdown for the festive sale”. It appears on the page as it&apos;s written.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[90%] rounded-control px-3 py-2 text-sm whitespace-pre-line", m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start border bg-surface")}>
            {m.text}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 self-start rounded-control border bg-surface px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {phase.status}…
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ai-chat-input" className="sr-only">Tell AI what to add</label>
        <Textarea
          id="ai-chat-input"
          rows={3}
          maxLength={2000}
          value={text}
          autoFocus={autoFocus}
          placeholder="Tell AI what to add…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          className="resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {allowanceError ?? (allowance ? allowanceText(allowance) : "Checking your AI allowance…")}
          </p>
          {running ? (
            <Button type="button" size="sm" variant="secondary" onClick={stop}>
              <Square aria-hidden /> Stop
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => void send()} disabled={!ready}>
              <Send aria-hidden /> Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
