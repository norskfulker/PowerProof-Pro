"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Brush, ExternalLink, Receipt, Sparkles, Wallet, Wand2, type LucideIcon } from "lucide-react";
import { SetupJourney } from "@/components/onboarding/setup-journey";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { useCurrentStore } from "@/hooks/use-current-store";
import { cn } from "@/lib/utils";

const EDITOR = "/store/current/design/pages/home/edit";

const CHOICES: { href: string; icon: LucideIcon; title: string; body: string; points: string[]; cta: string; badge?: string; primary?: boolean }[] = [
  {
    href: "/store/current/design/studio",
    icon: Sparkles,
    title: "Create with AI",
    body: "Describe the store you want and watch it being built. Keep chatting to change anything.",
    points: ["Builds every section from your real products", "Redesigns colours, fonts and layout", "Free: 100 messages · Pro: 10 builds a day · Your own AI key: no limit"],
    cta: "Open AI Studio",
    badge: "New",
    primary: true,
  },
  {
    href: EDITOR,
    icon: Brush,
    title: "Create custom",
    body: "The full editor: drag sections, click to type, and set every detail yourself.",
    points: ["Drag and drop on the page", "Ready-made sections and blocks", "Theme, header, footer and pages"],
    cta: "Open the editor",
  },
  {
    href: `${EDITOR}?copy=1`,
    icon: Wand2,
    title: "Copy a store",
    body: "Paste the address of a store you like. Start from its colours, fonts and sections.",
    points: ["Works with Shopify themes and most sites", "Only the look: never their words or pictures", "Undo, or change anything after"],
    cta: "Paste an address",
  },
];

/**
 * Right after the first product (?first=1): where the setup road stands, and the steps after
 * building: show the product in the live store, then get paid and track orders.
 */
function FirstRun() {
  const first = useSearchParams().get("first") === "1";
  const { data: store } = useCurrentStore();
  if (!first) return null;
  return (
    <div className="mb-6 flex flex-col gap-4">
      <SetupJourney current={3} />
      <div className="flex flex-wrap items-center gap-2 rounded-card border bg-surface-sunken p-3 text-sm">
        <span className="mr-auto text-muted-foreground">Your product is saved. Build the store around it, then:</span>
        {store && (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/s/${store.slug}`} target="_blank">
              <ExternalLink aria-hidden /> Show my product
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="secondary">
          <Link href="/sales/payouts/methods">
            <Wallet aria-hidden /> Get paid
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href="/sales/orders">
            <Receipt aria-hidden /> Track orders
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** My Store: how to build the store. Each way ends in the same editor, so they can be mixed freely. */
export default function MyStorePage() {
  return (
    <>
      <title>My Store · PowerProof</title>
      <Suspense>
        <FirstRun />
      </Suspense>
      <PageHeader title="My Store" className="mb-2 md:mb-3" />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground md:mb-8">How would you like to build it? You can switch any time: everything ends up in the same editor.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CHOICES.map(({ href, icon: Icon, title, body, points, cta, badge, primary }) => (
          <Link
            key={title}
            href={href}
            className={cn(
              "group relative flex flex-col gap-4 rounded-card border bg-surface p-5 transition-[border-color,box-shadow] hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary md:p-6",
              primary && "border-primary/40 bg-[linear-gradient(160deg,var(--primary-soft),var(--surface)_55%)]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("grid size-11 place-items-center rounded-control", primary ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")} aria-hidden>
                <Icon className="size-5" />
              </span>
              {badge && <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">{badge}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-xl">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
            <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {points.map((p) => (
                <li key={p} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />{p}</li>
              ))}
            </ul>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
              {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
