"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Remembers which forms on the page have unsaved changes. While any do:
 * - clicking an in-app link asks before leaving,
 * - refreshing or closing the tab shows the browser's own warning.
 *
 * It only ever asks after the person has actually typed, picked or clicked something on this
 * page. A form that merely tidies its own values when it loads (filling a default, formatting a
 * colour) is not "unsaved changes", so just opening a page and moving on never prompts.
 */
interface Guard {
  set: (id: string, dirty: boolean) => void;
  /** Ask before running `go` if anything is unsaved */
  confirmLeave: (go: () => void) => void;
}

const Ctx = createContext<Guard | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dirty = useRef(new Set<string>());
  // Has the person done anything on this page yet?
  const acted = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const unsaved = () => dirty.current.size > 0 && acted.current;

  useEffect(() => {
    acted.current = false;
  }, [pathname]);

  const set = useCallback((id: string, d: boolean) => {
    if (d) dirty.current.add(id);
    else dirty.current.delete(id);
  }, []);

  const confirmLeave = useCallback((go: () => void) => {
    if (!unsaved()) return go();
    setPending(() => go);
  }, []);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (unsaved()) e.preventDefault();
    };
    // Typing, picking and clicking controls count as "the person did something"; following a link doesn't
    const onAct = (e: Event) => {
      if (!(e.target as HTMLElement | null)?.closest?.("a[href]")) acted.current = true;
    };
    const onClick = (e: MouseEvent) => {
      if (!unsaved() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => router.push(url.pathname + url.search + url.hash));
    };
    const acts = ["input", "change", "keydown", "paste", "pointerdown"] as const;
    for (const a of acts) document.addEventListener(a, onAct, true);
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      for (const a of acts) document.removeEventListener(a, onAct, true);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);

  return (
    <Ctx.Provider value={{ set, confirmLeave }}>
      {children}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Leave without saving?</DialogTitle>
            <DialogDescription>You have changes that aren&apos;t saved. If you leave now, they&apos;re lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Stay
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const go = pending;
                dirty.current.clear();
                setPending(null);
                go?.();
              }}
            >
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useUnsavedGuard(): Guard {
  return useContext(Ctx) ?? { set: () => {}, confirmLeave: (go) => go() };
}
