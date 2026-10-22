"use client";

import { createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import { createEditorStore, type EditorState, type EditorStore, type SiteDraft } from "@/lib/pages/editor-store";
import type { PageDoc } from "@/lib/pages/schema";

const EditorCtx = createContext<EditorStore | null>(null);

/** One editor store per open page. */
export function EditorProvider({ initial, site, children }: { initial: PageDoc; /** Store-wide settings, edited beside the page */ site?: SiteDraft; children: React.ReactNode }) {
  const [store] = useState(() => createEditorStore(initial, site));
  return <EditorCtx.Provider value={store}>{children}</EditorCtx.Provider>;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  const store = useContext(EditorCtx);
  if (!store) throw new Error("useEditor needs an EditorProvider");
  return useStore(store, selector);
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorCtx);
  if (!store) throw new Error("useEditorStore needs an EditorProvider");
  return store;
}
