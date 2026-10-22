import type { DealRuleInput } from "../pricing/deal-rule-schema";
import { isRuleLive } from "../pricing/deals";
import type { DealRule } from "../types";
import { liveChange } from "./live/notify";
import * as live from "./live/catalog";

/** Creator side of deal paths: the active store's rules, read and written in the database. */
export type DealRuleStatus = "active" | "scheduled" | "ended" | "paused";

export function dealRuleStatus(r: DealRule, now = Date.now()): DealRuleStatus {
  if (!r.active) return "paused";
  if (r.endsAt && Date.parse(r.endsAt) <= now) return "ended";
  if (r.startsAt && Date.parse(r.startsAt) > now) return "scheduled";
  return isRuleLive(r, now) ? "active" : "paused";
}

export const getDealRules = (): Promise<DealRule[]> => live.getDealRules();
export const getDealRule = (id: string): Promise<DealRule> => live.getDealRule(id);
export const saveDealRule = (input: DealRuleInput): Promise<DealRule> => liveChange(live.saveDealRule(input));
export const setDealRuleActive = (id: string, active: boolean): Promise<DealRule> => liveChange(live.setDealRuleActive(id, active));
export const deleteDealRule = (id: string): Promise<void> => liveChange(live.deleteDealRule(id));
