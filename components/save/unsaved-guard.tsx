"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Remembers which forms on the page have unsaved changes. While any do:
 * - clicking an in-app link asks before leaving,
 * - refreshing or closing the tab shows the browser's own warning.
 */
interface Guard {
  set: (id: string, dirty: boolean) => void;
  /** Ask before running `go` if anything is unsaved */
  confirmLeave: (go: () => void) => void;
}

const Ctx = createContext<Guard | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dirty = useRef(new Set<string>());
  const [pending, setPending] = useState<(() => void) | null>(null);

  const set = useCallback((id: string, d: boolean) => {
    if (d) dirty.current.add(id);
    else dirty.current.delete(id);
  }, []);

  const confirmLeave = useCallback((go: () => void) => {
    if (dirty.current.size === 0) return go();
    setPending(() => go);
  }, []);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current.size) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!dirty.current.size || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => router.push(url.pathname + url.search + url.hash));
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
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
