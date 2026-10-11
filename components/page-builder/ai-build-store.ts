"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { addVisualVersion, buildPageWithAi, getAiPageAllowance, updateVisualPageMeta } from "@/lib/api";
import { AI_FREE_MESSAGES } from "@/lib/plans";
import { finishAiDoc, type AiBrief } from "@/lib/pages/ai";
import type { EditorStore, SiteDraft } from "@/lib/pages/editor-store";
import type { PageDoc, PageNode } from "@/lib/pages/schema";

export type AiPhase
  = { kind: "idle" }
  | { kind: "running"; status: string; sections: number }
  | { kind: "review"; sections: number; summary: string; notes: string[]; error?: string };

export interface AiMessage {
  role: "user" | "ai";
  text: string;
}

export interface AiAllowance {
  connected: boolean;
  used: number;
  daily: number;
  /** Free messages left (lifetime). Null for Pro, which builds daily instead. */
  freeLeft: number | null;
}

/** One line under the input: what the quota looks like right now. */
export function allowanceText(a: AiAllowance): string {
  const left = Math.max(0, a.daily - a.used);
  if (!a.connected) return "AI page building isn't connected yet.";
  if (a.freeLeft !== null) {
    if (a.freeLeft <= 0) return `You've used your ${AI_FREE_MESSAGES} free AI messages. Pro builds ${a.daily} pages a day.`;
    return `${a.freeLeft} of ${AI_FREE_MESSAGES} free messages left`;
  }
  if (left === 0) return `You've used today's ${a.daily === 1 ? "AI page" : `${a.daily} AI pages`}. More tomorrow.`;
  return `${left} of ${a.daily} AI page${a.daily === 1 ? "" : "s"} left today`;
}

export interface AiRunMeta {
  pageId: string;
  isHome: boolean;
  slug: string;
  /** Where streamed sections land. Undefined appends at the end (full-page builds). */
  insertIndex?: number;
  /** Started from the add-section chat rather than the brief dialog */
  fromChat: boolean;
}

interface AiBuildState {
  phase: AiPhase;
  messages: AiMessage[];
  /** The brief of the running (or last) build, so Try again repeats it */
  brief?: AiBrief;
  meta?: AiRunMeta;
  allowance?: AiAllowance;
  allowanceError?: string;
  aborter: AbortController | null;
  editorRef?: EditorStore;
  seo?: { title: string; description: string };
  refreshAllowance: () => Promise<void>;
  /** One run at a time: streams sections onto the canvas through the editor's AI preview */
  start: (editor: EditorStore, brief: AiBrief, meta: AiRunMeta) => Promise<{ placed: number; error?: string }>;
  stop: () => void;
  keep: (flush: () => Promise<void>) => Promise<void>;
  discard: (reopen: () => void) => void;
  pushUser: (text: string) => void;
  pushAi: (text: string) => void;
  clearChat: () => void;
}

const idle: AiPhase = { kind: "idle" };

export const useAiBuild = create<AiBuildState>((set, get) => ({
  phase: idle,
  messages: [],
  aborter: null,

  async refreshAllowance() {
    try {
      const a = await getAiPageAllowance();
      set({ allowance: a, allowanceError: undefined });
    } catch (e) {
      set({ allowanceError: e instanceof Error ? e.message : "Couldn't check your AI allowance." });
    }
  },

  pushUser(text) {
    set((s) => ({ messages: [...s.messages, { role: "user", text }] }));
  },

  pushAi(text) {
    set((s) => ({ messages: [...s.messages, { role: "ai", text }] }));
  },

  clearChat() {
    if (get().phase.kind === "running") return;
    set({ messages: [] });
  },

  stop() {
    get().aborter?.abort();
  },

  async start(editor, brief, meta) {
    if (get().phase.kind === "running") return { placed: 0 };
    const allowance = get().allowance;
    const left = allowance ? Math.max(0, allowance.daily - allowance.used) : undefined;
    if (!allowance?.connected || left === 0 || (allowance.freeLeft !== null && allowance.freeLeft <= 0)) return { placed: 0 };
    if (editor.getState().doc.blocks.length >= 40) {
      const error = "That's 40 sections, the most a page can have.";
      toast.error(error);
      return { placed: 0, error };
    }

    editor.getState().beginAi();
    // Full-page builds replace; chat appends (spliced at the picked spot below)
    let doc: PageDoc = brief.mode === "replace" ? { ...editor.getState().doc, blocks: [] } : editor.getState().doc;
    let site: SiteDraft | undefined = editor.getState().site;
    let placed = 0;
    const notes: string[] = [];
    let summary = "";
    let failed: string | undefined;
    set({ seo: undefined, brief, meta, editorRef: editor, phase: { kind: "running", status: "Starting", sections: 0 } });
    editor.getState().showAi(doc, site);
    const aborter = new AbortController();
    set({ aborter });

    const applyNode = (node: PageNode) => {
      const cur = editor.getState().doc;
      if (cur.blocks.length >= 40) {
        failed = "The page already has 40 sections, so the rest were left out.";
        return;
      }
      const at = meta.insertIndex === undefined ? cur.blocks.length : Math.min(meta.insertIndex + placed, cur.blocks.length);
      doc = { ...cur, blocks: [...cur.blocks.slice(0, at), node, ...cur.blocks.slice(at)] };
      placed++;
      editor.getState().showAi(doc, site);
      set({ phase: { kind: "running", status: `Added section ${placed}`, sections: placed } });
    };

    try {
      await buildPageWithAi(
        meta.pageId,
        brief,
        (e) => {
          if (e.type === "status") set({ phase: { kind: "running", status: e.text, sections: placed } });
          else if (e.type === "section") applyNode(e.node);
          else if (e.type === "theme" && site) {
            const d = site.design;
            const sections = d.sections.some((x) => x.id === "announcement")
              ? d.sections.map((x) => (x.id === "announcement" ? { ...x, enabled: !!e.announcement } : x))
              : [{ id: "announcement", enabled: !!e.announcement }, ...d.sections];
            site = { ...site, design: { ...d, theme: e.theme, announcement: { ...d.announcement, text: e.announcement || d.announcement.text }, sections, ...(meta.isHome ? { seo: e.seo } : {}) } };
            set({ seo: e.seo });
            editor.getState().showAi(doc, site);
          } else if (e.type === "note") notes.push(e.text);
          else if (e.type === "done") summary = e.summary;
          else if (e.type === "error") failed = e.message;
        },
        aborter.signal
      );
    } catch (e) {
      failed = e instanceof DOMException && e.name === "AbortError" ? "Stopped." : e instanceof Error ? e.message : "AI couldn't build the page.";
    }
    set({ aborter: null });
    // The allowance moved: one message sent, one run recorded
    void get().refreshAllowance();
    if (placed === 0) {
      editor.getState().endAi(false);
      set({ phase: idle });
      const error = failed ?? "AI didn't add any sections. Try a more detailed description.";
      get().pushAi(error);
      return { placed: 0, error };
    }
    editor.getState().showAi(finishAiDoc(doc, meta.slug), site);
    get().pushAi(failed ?? (summary || `Added ${placed} section${placed === 1 ? "" : "s"}. Look it over, then keep it or discard it.`));
    set({ phase: { kind: "review", sections: placed, summary, notes, error: failed } });
    return { placed, error: failed };
  },

  async keep(flush) {
    const { meta, seo, editorRef } = get();
    editorRef?.getState().endAi(true);
    set({ phase: idle });
    try {
      await flush();
      if (meta) {
        await addVisualVersion(meta.pageId, editorRef!.getState().doc, `AI draft · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`);
        if (!meta.isHome && seo) await updateVisualPageMeta(meta.pageId, { seo });
      }
      toast.success("Kept, and saved as a version", { description: "Change anything you like. Buyers see it when you publish." });
    } catch {
      toast.success("Kept", { description: "Change anything you like. Buyers see it when you publish." });
    }
  },

  discard(reopen) {
    get().editorRef?.getState().endAi(false);
    set({ phase: idle });
    reopen();
  },
}));
