"use client";

import { createContext, Suspense, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, PartyPopper, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useApi } from "@/hooks/use-api";
import { dismissChecklist, getChecklist, markCoachSeen, markWelcomed, skipStep, type Checklist, type StepId } from "@/lib/api";
import { ProgressRing, StepItem } from "./parts";

interface Ctx {
  checklist?: Checklist;
  openDrawer: () => void;
  reload: () => void;
}

const GSContext = createContext<Ctx | null>(null);

export function useGettingStarted(): Ctx {
  return useContext(GSContext) ?? { openDrawer: () => {}, reload: () => {} };
}

/** The full list of steps, with skip and dismiss. Used by the drawer and the dashboard card. */
export function StepList({ checklist, onGo, compactDone }: { checklist: Checklist; onGo?: () => void; compactDone?: boolean }) {
  const { reload } = useGettingStarted();
  const skip = async (id: StepId, s: boolean) => {
    await skipStep(id, s);
    reload();
  };
  const steps = compactDone ? checklist.steps.filter((s) => s.state !== "done" || s.id === checklist.next?.id) : checklist.steps;
  return (
    <ol className="flex flex-col" aria-label="Setup steps">
      {steps.map((s) => (
        <StepItem key={s.id} step={s} isNext={checklist.next?.id === s.id} onGo={onGo} onSkip={() => skip(s.id, true)} onUnskip={() => skip(s.id, false)} />
      ))}
    </ol>
  );
}

/**
 * Coach-mark: when the creator arrives from "Next step" (?coach=<step>), points at the exact thing to
 * do. Got it closes it for good; Skip tour turns them all off. Never shown again for a finished step.
 */
function CoachMark({ checklist, reload }: { checklist: Checklist; reload: () => void }) {
  const params = useSearchParams();
  const id = params.get("coach") as StepId | null;
  const step = checklist.steps.find((s) => s.id === id);
  const show = !!step && step.state !== "done" && step.state !== "skipped" && !checklist.tourSkipped && !checklist.coachSeen.includes(step.id);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [closed, setClosed] = useState<string | null>(null);

  useEffect(() => {
    if (!show || !step) return;
    let frame = 0;
    let tries = 0;
    const place = () => {
      const el = document.querySelector<HTMLElement>(`[data-coach="${step.coach}"]`);
      if (!el) {
        if (tries++ < 40) frame = window.setTimeout(place, 150) as unknown as number;
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const update = () => {
        const r = el.getBoundingClientRect();
        setPos({ top: r.bottom + window.scrollY + 10, left: Math.max(16, Math.min(r.left + window.scrollX, window.innerWidth - 336)), width: r.width });
        el.dataset.coachActive = "true";
      };
      update();
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, { passive: true });
      cleanup = () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update);
        delete el.dataset.coachActive;
      };
    };
    let cleanup = () => {};
    frame = window.setTimeout(place, 50) as unknown as number;
    return () => {
      clearTimeout(frame);
      cleanup();
    };
  }, [show, step]);

  if (!show || !step || !pos || closed === step.id) return null;
  const close = async (skipTour: boolean) => {
    setClosed(step.id);
    await markCoachSeen(step.id, skipTour);
    reload();
  };
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="coach-title" className="absolute z-50 w-80 max-w-[calc(100vw-2rem)] rounded-card border bg-surface p-4 shadow-pop" style={{ top: pos.top, left: pos.left }}>
      <p id="coach-title" className="font-semibold">
        Step {step.n}: {step.title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{step.coachText}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => close(true)}>
          Skip tour
        </Button>
        <Button type="button" size="sm" onClick={() => close(false)}>
          Got it
        </Button>
      </div>
    </div>
  );
}

/** The first-sign-in welcome: the plan in three lines and a button to start. */
function WelcomeDialog({ checklist, onDone }: { checklist: Checklist; onDone: () => void }) {
  const [open, setOpen] = useState(true);
  const close = async () => {
    setOpen(false);
    await markWelcomed();
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Rocket className="size-6 text-accent-ink" aria-hidden /> Welcome to PowerProof
          </DialogTitle>
          <DialogDescription>Here&apos;s the plan. It takes about 15 minutes.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-2 text-sm">
          <li><span className="font-semibold">1. Set up:</span> verify your email, name your store, add where to get paid.</li>
          <li><span className="font-semibold">2. Add and style:</span> your first product, your hero, colours and About.</li>
          <li><span className="font-semibold">3. Go live:</span> publish, share your link, and watch for your first sale.</li>
        </ol>
        <p className="text-xs text-muted-foreground">Your checklist stays in the sidebar until you&apos;re done, and remembers where you left off.</p>
        <DialogFooter>
          <Button variant="secondary" onClick={close}>Later</Button>
          {checklist.next && (
            <Button asChild onClick={() => close()}>
              <Link href={checklist.next.href}>
                Start: {checklist.next.title} <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GettingStartedProvider({ children }: { children: React.ReactNode }) {
  const { data, reload } = useApi(getChecklist, [], { live: true });
  const [drawer, setDrawer] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  // A small celebration when the last required step is done, only if this browser saw it unfinished
  useEffect(() => {
    if (!data || celebrated || data.dismissed) return;
    const pending = "pp:gs-unfinished";
    const key = "pp:gs-celebrated";
    try {
      if (!data.complete) {
        localStorage.setItem(pending, "1");
        return;
      }
      if (!localStorage.getItem(pending) || localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    const t = setTimeout(() => {
      setCelebrated(true);
      toast.success("You're all set up", { description: "Your store is live. Keep sharing it." });
    }, 0);
    return () => clearTimeout(t);
  }, [data, celebrated]);

  return (
    <GSContext.Provider value={{ checklist: data, openDrawer: () => setDrawer(true), reload }}>
      {children}
      {data && !data.welcomed && <WelcomeDialog checklist={data} onDone={reload} />}
      {data && (
        <Suspense>
          <CoachMark checklist={data} reload={reload} />
        </Suspense>
      )}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="right" className="w-full overflow-y-auto p-5 sm:max-w-md">
          <div className="flex items-center gap-3">
            <ProgressRing percent={data?.percent ?? 0} size={52} />
            <div>
              <SheetTitle className="font-display text-xl">Getting started</SheetTitle>
              <SheetDescription>{data?.complete ? "Everything required is done." : `${data?.steps.filter((s) => s.state === "done" || s.state === "skipped").length ?? 0} of ${data?.steps.length ?? 10} steps finished.`}</SheetDescription>
            </div>
          </div>
          {data && (
            <div className="mt-4 flex flex-col gap-4">
              <StepList checklist={data} onGo={() => setDrawer(false)} />
              {data.complete && !data.dismissed && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await dismissChecklist(true);
                    reload();
                    setDrawer(false);
                    toast("Checklist hidden", { description: "Reopen it any time from the help menu." });
                  }}
                >
                  <X aria-hidden /> Hide the checklist
                </Button>
              )}
              {data.complete && <p className="flex items-center gap-2 text-sm text-success"><PartyPopper className="size-4" aria-hidden /> Nicely done.</p>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </GSContext.Provider>
  );
}
