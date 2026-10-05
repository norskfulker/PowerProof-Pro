import { money } from "../money";
import { commit, db } from "../mock/db";
import { uid } from "../mock/random";
import { dealRuleSchema, type DealRuleInput } from "../pricing/deal-rule-schema";
import { isRuleLive } from "../pricing/deals";
import type { DealRule } from "../types";
import { ApiError, call, notFound } from "./client";

/** Creator side of deal paths (Part 4B): the creator's own store only. */

export type DealRuleStatus = "active" | "scheduled" | "ended" | "paused";

export function dealRuleStatus(r: DealRule, now = Date.now()): DealRuleStatus {
  if (!r.active) return "paused";
  if (r.endsAt && Date.parse(r.endsAt) <= now) return "ended";
  if (r.startsAt && Date.parse(r.startsAt) > now) return "scheduled";
  return isRuleLive(r, now) ? "active" : "paused";
}

export function getDealRules(): Promise<DealRule[]> {
  return call(() => db().dealRules);
}

export function getDealRule(id: string): Promise<DealRule> {
  return call(() => db().dealRules.find((r) => r.id === id) ?? notFound("Deal path"));
}

export function saveDealRule(input: DealRuleInput): Promise<DealRule> {
  return call(() => {
    const parsed = dealRuleSchema.safeParse(input);
    if (!parsed.success) throw new ApiError(parsed.error.issues[0].message, "validation");
    const d = db();
    const ids = new Set(d.products.map((p) => p.id));
    const used = [
      ...("productIds" in parsed.data ? parsed.data.productIds : []),
      ...("triggerIds" in parsed.data ? parsed.data.triggerIds : []),
      ...("giftIds" in parsed.data ? parsed.data.giftIds : []),
      ...("giftId" in parsed.data ? [parsed.data.giftId] : []),
    ];
    if (used.some((id) => !ids.has(id))) throw new ApiError("One of the products no longer exists. Pick again.", "validation");
    const existing = parsed.data.id ? d.dealRules.find((r) => r.id === parsed.data.id) : undefined;
    const rule = {
      ...parsed.data,
      id: existing?.id ?? uid("dr"),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      stats: existing?.stats ?? { views: 0, uses: 0, revenueLift: money(0) },
    } as DealRule;
    commit((x) => {
      x.dealRules = existing ? x.dealRules.map((r) => (r.id === rule.id ? rule : r)) : [rule, ...x.dealRules];
    });
    return rule;
  });
}

export function setDealRuleActive(id: string, active: boolean): Promise<DealRule> {
  return call(() => {
    const r = db().dealRules.find((x) => x.id === id) ?? notFound("Deal path");
    commit(() => (r.active = active));
    return r;
  }, { fast: true });
}

export function deleteDealRule(id: string): Promise<void> {
  return call(() => {
    commit((d) => (d.dealRules = d.dealRules.filter((r) => r.id !== id)));
  });
}
