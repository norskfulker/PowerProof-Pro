"use client";

import { createContext, useCallback, useContext, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { ApiError, getPlanLimits, getPlanState, type PlanState } from "@/lib/api";
import { cn } from "@/lib/utils";
import { proBenefits, PRO_PRICE_INR, PRO_TRIAL_DAYS, type AllPlanLimits } from "@/lib/plans";

export type LimitKind = "stores" | "products" | "pages" | "aiCredits";

interface PlanCtx {
  state?: PlanState;
  reload: () => void;
  /** Free and Pro limits from plan_limits (undefined while loading) */
  limits?: AllPlanLimits;
  /** Opens the Upgrade dialog, explaining which limit was reached */
  upgrade: (kind?: LimitKind) => void;
  /**
   * Runs `action` if the plan allows one more store or product; otherwise opens the Upgrade dialog.
   * Never blocks silently.
   */
  guard: (kind: "stores" | "products" | "pages", action: () => void) => void;
  /** Turns a "limit" error from the API into the Upgrade dialog. Returns true if it handled it. */
  handleLimitError: (e: unknown) => boolean;
}

const Ctx = createContext<PlanCtx | null>(null);

/** What the browser needs to open Razorpay's subscription authorisation window. */
interface BillingRazorpayWindow {
  Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
}

const BILLING_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let billingLoading: Promise<void> | undefined;
function loadBillingRazorpay(): Promise<void> {
  const w = window as unknown as BillingRazorpayWindow;
  if (w.Razorpay) return Promise.resolve();
  billingLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = BILLING_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      billingLoading = undefined;
      reject(new Error("The payment window couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return billingLoading;
}

function reason(kind: LimitKind, l: AllPlanLimits | undefined): string {
  const n = (v: number | null | undefined, one: string, many: string) => (v == null ? many : `${v} ${v === 1 ? one : many}`);
  switch (kind) {
    case "products":
      return `The Free plan includes ${n(l?.free.products, "product", "products")}. Pro lets you add as many as you like.`;
    case "pages":
      return `The Free plan includes ${n(l?.free.pages, "page", "pages")}. Pro lets you build as many launch, sale and link-in-bio pages as you like.`;
    case "stores":
      return `The Free plan includes ${n(l?.free.stores, "store", "stores")}. Pro lets you open more, each with its own look, products and policies.`;
    case "aiCredits":
      return l ? `You've used this month's ${l.free.aiCredits} AI image credits. Pro includes ${l.pro.aiCredits} a month.` : "You've used this month's AI image credits.";
  }
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, reload } = useApi(getPlanState, [], { live: true });
  const { data: limits } = useApi(getPlanLimits, []);
  const [open, setOpen] = useState<LimitKind | "general" | null>(null);
  const [pending, setPending] = useState(false);

  // Every Pro button lands here: it explains Pro first, and only the dialog's Upgrade button opens Razorpay
  const upgrade = useCallback((kind?: LimitKind) => setOpen(kind ?? "general"), []);

  const guard = useCallback(
    (kind: "stores" | "products" | "pages", action: () => void) => {
      if (!data) return action();
      const max = data.limits[kind];
      if (max === null || data.usage[kind] < max) action();
      else setOpen(kind);
    },
    [data]
  );

  const handleLimitError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.code === "limit") {
      const kind = (e as ApiError & { kind?: LimitKind }).kind ?? "products";
      setOpen(kind);
      return true;
    }
    return false;
  }, []);

  const doUpgrade = useCallback(async () => {
    // Close the dialog first so Razorpay's window isn't stacked under it
    setOpen(null);
    setPending(true);
    try {
      const started = await fetch("/api/billing/subscribe", { method: "POST" }).then((r) => r.json()).catch(() => ({ ok: false, message: "We couldn't reach the server." })) as
        | { ok: true; keyId: string; subscriptionId: string }
        | { ok: false; message: string };
      if (!started.ok) {
        toast.error(started.message ?? "We couldn't start that. Try again.");
        return setPending(false);
      }
      await loadBillingRazorpay();
      const Razorpay = (window as unknown as BillingRazorpayWindow).Razorpay!;
      const rz = new Razorpay({
        key: started.keyId,
        subscription_id: started.subscriptionId,
        name: "PowerProof Pro",
        description: `₹${PRO_PRICE_INR.toLocaleString("en-IN")}/month, first ${PRO_TRIAL_DAYS} days free`,
        theme: { color: "#0F3D33" },
        modal: { ondismiss: () => setPending(false) },
        handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          const done = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ paymentId: r.razorpay_payment_id, subscriptionId: r.razorpay_subscription_id, signature: r.razorpay_signature }),
          }).then((x) => x.json()).catch(() => ({ ok: false, message: "We couldn't confirm that." })) as { ok: boolean; message?: string };
          if (done.ok) {
            reload();
            toast.success("You're on Pro", { description: `Your first ${PRO_TRIAL_DAYS} days are free. Your card is authorised now and charged after the trial.` });
            router.refresh();
          } else {
            toast.error(done.message ?? "We couldn't confirm that authorisation.");
          }
          setPending(false);
        },
      });
      rz.on("payment.failed", (r) => {
        toast.error(r.error?.description ?? "The authorisation didn't go through. You haven't been charged.");
        setPending(false);
      });
      rz.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't upgrade you just now.");
      setPending(false);
    }
  }, [reload, router]);

  return (
    <Ctx.Provider value={{ state: data, limits, reload, upgrade, guard, handleLimitError }}>
      {children}
      <Dialog open={open !== null} onOpenChange={(o) => !pending && !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Sparkles className="size-5 text-accent-ink" aria-hidden /> Upgrade to Pro
            </DialogTitle>
            <DialogDescription>{open && open !== "general" ? reason(open, limits) : "Pro removes the Free plan's limits."}</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 text-sm">
            {(limits ? proBenefits(limits) : []).map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {b}
              </li>
            ))}
          </ul>
          <p className="rounded-control bg-accent-soft px-3 py-2 text-sm">
            <span className="font-display text-2xl">₹{PRO_PRICE_INR.toLocaleString("en-IN")}</span> a month. <span className="font-semibold">First {PRO_TRIAL_DAYS} days free</span>, card authorised now and charged after the trial. Cancel any time.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(null)} disabled={pending}>
              Not now
            </Button>
            <Button onClick={doUpgrade} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function usePlan(): PlanCtx {
  const c = useContext(Ctx);
  // Outside the creator app (marketing, tests) the guard just runs the action
  return c ?? { limits: undefined, reload: () => {}, upgrade: () => {}, guard: (_k, a) => a(), handleLimitError: () => false };
}

/**
 * A link to a "create" screen (new product, new store). On the Free plan at the limit it opens the
 * Upgrade dialog instead of navigating, so nothing is blocked silently.
 */
export function GuardedLink({ kind, href, children, className, ...rest }: { kind: "stores" | "products"; href: string; children: React.ReactNode; className?: string } & Omit<React.ComponentProps<typeof Link>, "href">) {
  const plan = usePlan();
  return (
    <Link
      href={href}
      className={className}
      {...rest}
      onClick={(e) => {
        const s = plan.state;
        const max = s?.limits[kind];
        if (s && max !== null && max !== undefined && s.usage[kind] >= max) {
          e.preventDefault();
          plan.upgrade(kind);
        }
      }}
    >
      {children}
    </Link>
  );
}

/** Tells a Free creator up front that they're at a limit, before they fill anything in. */
export function LimitNotice({ kind, className }: { kind: "stores" | "products"; className?: string }) {
  const plan = usePlan();
  const s = plan.state;
  const max = s?.limits[kind];
  if (!s || max === null || max === undefined || s.usage[kind] < max) return null;
  const noun = kind === "products" ? "product" : "store";
  return (
    <div role="status" className={cn("mb-6 flex flex-col gap-3 rounded-card border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center", className)}>
      <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-sm">
        <span className="font-semibold">You&apos;ve used your {max} free {noun}{max === 1 ? "" : "s"}.</span> Upgrade to Pro to add more. You can still edit what you have.
      </p>
      <Button size="sm" onClick={() => plan.upgrade(kind)}>See Pro</Button>
    </div>
  );
}
