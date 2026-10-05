import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brass" | "primary";

const MAP: Record<string, [string, Tone]> = {
  // orders
  paid: ["Paid", "success"],
  pending: ["Pending", "neutral"],
  refund_requested: ["Refund asked", "warning"],
  refunded: ["Refunded", "neutral"],
  failed: ["Failed", "danger"],
  // products / pages
  published: ["Live", "success"],
  live: ["Live", "success"],
  draft: ["Draft", "neutral"],
  archived: ["Archived", "neutral"],
  // payouts
  processing: ["On its way", "info"],
  queued: ["Queued", "info"],
  on_hold: ["On hold", "warning"],
  sent: ["Sent", "success"],
  // admin
  open: ["Open", "warning"],
  under_review: ["Under review", "info"],
  won: ["Won", "success"],
  lost: ["Lost", "danger"],
  removed: ["Removed", "danger"],
  dismissed: ["Dismissed", "neutral"],
  verified: ["Verified", "success"],
  rejected: ["Rejected", "danger"],
  active: ["Active", "success"],
  trial: ["Free month", "brass"],
  past_due: ["Past due", "danger"],
  suspended: ["Suspended", "danger"],
  invited: ["Invited", "info"],
  connected: ["Connected", "success"],
  not_connected: ["Not connected", "neutral"],
  coming_soon: ["Coming soon", "brass"],
  low: ["Low", "success"],
  medium: ["Medium", "warning"],
  high: ["High", "danger"],
  due: ["Due", "warning"],
  free: ["Free", "brass"],
  // deal paths, coupons
  scheduled: ["Scheduled", "info"],
  ended: ["Ended", "neutral"],
  paused: ["Paused", "neutral"],
  inactive: ["Off", "neutral"],
  // reviews and questions
  shown: ["Shown", "success"],
  hidden: ["Hidden", "neutral"],
  reported: ["Reported", "warning"],
  answered: ["Answered", "success"],
};

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  brass: "bg-accent-strong",
  primary: "bg-primary-foreground",
};

export function StatusPill({
  status,
  label,
  tone,
  className,
}: {
  status: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const [l, t] = MAP[status] ?? [status.replace(/_/g, " "), "neutral" as Tone];
  const finalTone = tone ?? t;
  return (
    <Badge variant={finalTone} className={className}>
      <span className={cn("size-1.5 rounded-full", DOT[finalTone])} aria-hidden />
      {label ?? l}
    </Badge>
  );
}
