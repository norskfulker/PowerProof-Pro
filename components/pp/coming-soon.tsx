import { Clock } from "lucide-react";
import { EmptyState } from "@/components/pp/empty-state";

/**
 * For anything the product doesn't do yet. Says so plainly and offers one next step: it never
 * shows made-up data in place of the real thing.
 */
export function ComingSoon({ title, body, action, compact, className }: { title: string; body?: React.ReactNode; action?: React.ReactNode; compact?: boolean; className?: string }) {
  return (
    <EmptyState
      icon={Clock}
      title={title}
      body={
        <>
          <span className="mb-2 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">Coming soon</span>
          {body && <span className="block">{body}</span>}
        </>
      }
      action={action}
      compact={compact}
      className={className}
    />
  );
}
