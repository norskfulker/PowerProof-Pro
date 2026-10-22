"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LaunchIssue } from "@/lib/pages/launch-check";
import { cn } from "@/lib/utils";

/**
 * What the check before publishing found: things that would break for buyers first, then things
 * that are missing or may look unfinished. Each one says how to fix it and takes you there.
 */
export function LaunchCheckDialog({
  open,
  onOpenChange,
  issues,
  goingLive,
  publishing,
  onPublish,
  onFix,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  issues: LaunchIssue[];
  goingLive: boolean;
  publishing: boolean;
  onPublish: () => void;
  /** Show the block, or open the panel, for an issue on this page */
  onFix: (issue: LaunchIssue) => void;
}) {
  const fix = issues.filter((i) => i.level === "fix");
  const check = issues.filter((i) => i.level === "check");
  const action = goingLive ? "Go live" : "Publish";

  const row = (i: LaunchIssue) => (
    <li key={i.id} className="flex items-start gap-3 py-3">
      {i.level === "fix" ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{i.title}</span>
        <span className="block text-sm text-muted-foreground">{i.detail}</span>
      </span>
      {i.href ? (
        <Button asChild size="sm" variant="secondary" className="shrink-0">
          <Link href={i.href} target="_blank" rel="noopener noreferrer">{i.fixLabel ?? "Fix"}</Link>
        </Button>
      ) : (i.nodeId || i.panel) ? (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={() => onFix(i)}>{i.fixLabel ?? "Fix"}</Button>
      ) : null}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !publishing && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{goingLive ? "Before you go live" : "Before you publish"}</DialogTitle>
          <DialogDescription>
            {fix.length
              ? `${fix.length} thing${fix.length === 1 ? "" : "s"} would break for buyers${check.length ? `, and ${check.length} more worth a look` : ""}.`
              : check.length
                ? "Nothing's broken. A few things look unfinished, so check them first if you like."
                : "Everything looks ready."}
          </DialogDescription>
        </DialogHeader>

        {!issues.length && (
          <p className="flex items-center gap-2 rounded-card border border-success/40 bg-success-soft px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="size-5" aria-hidden /> Links work, products are live and nothing is missing.
          </p>
        )}
        {!!fix.length && (
          <section aria-labelledby="lc-fix">
            <h3 id="lc-fix" className="eyebrow text-danger">Fix before buyers see it</h3>
            <ul className="divide-y">{fix.map(row)}</ul>
          </section>
        )}
        {!!check.length && (
          <section aria-labelledby="lc-check">
            <h3 id="lc-check" className="eyebrow">Worth checking</h3>
            <ul className="divide-y">{check.map(row)}</ul>
          </section>
        )}
        {goingLive && <p className="text-xs text-muted-foreground">You can go live with these and fix them after. Your store link starts working as soon as you do.</p>}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={publishing}>Keep editing</Button>
          <Button variant={fix.length ? "secondary" : "default"} className={cn(fix.length && "text-danger")} onClick={onPublish} disabled={publishing}>
            {publishing ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} {fix.length ? `${action} anyway` : action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
