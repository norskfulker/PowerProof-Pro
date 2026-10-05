import { db, getDemo, resetDb, setDemo, subscribe, type DemoSettings } from "../mock/db";

/** Demo controls: lets reviewers flip between seeded/empty data and force errors. */
export function getDemoState(): DemoSettings & { mode: "seeded" | "fresh" } {
  return { ...getDemo(), mode: db().mode };
}

export function setDemoState(next: Partial<DemoSettings>) {
  setDemo(next);
}

export function loadSampleData() {
  resetDb("seeded");
}

export function startEmptyStore() {
  const s = db().store;
  resetDb("fresh", { name: s.name, slug: s.slug, ownerName: s.ownerName, ownerEmail: s.ownerEmail, logoText: s.logoText, onboarded: true });
}

/** Subscribe to any data change, including ones from other tabs. */
export const onDataChange = subscribe;
