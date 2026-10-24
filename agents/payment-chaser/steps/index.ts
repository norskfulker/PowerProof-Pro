import { defineSteps, type StepCtx } from "@/lib/server/agents/runtime/types";
import manifest from "../manifest";
import { PROMPTS } from "../prompts/reminder";
import { draftMessages } from "./draft-messages";
import { loadOverdue } from "./load-overdue";
import { routeAndSend, type SendOutput } from "./route-and-send";

/** Log: one summary per run for Activity and the admin run list (the platform stores it) */
async function logAndMeter(ctx: StepCtx, input: SendOutput) {
  const sent = input.counts.sent ?? 0;
  const queued = input.counts.queued ?? 0;
  ctx.log("info", "run finished", { sent, queued, ...input.counts });
  return { sent, queued, counts: input.counts, skipped: input.skipped, preview: input.preview };
}

export default defineSteps(manifest, {
  load_overdue: loadOverdue,
  draft_messages: draftMessages,
  route_and_send: routeAndSend,
  log_and_meter: logAndMeter,
}, PROMPTS);
