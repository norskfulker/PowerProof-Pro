/** Emails PowerProof sends to a creator (profiles.notify). Each is on unless switched off; the bell is always on. */
export interface EmailPrefs {
  newOrder: boolean;
  payouts: boolean;
}
export const DEFAULT_EMAIL_PREFS: EmailPrefs = { newOrder: true, payouts: true };

export function emailPrefsFrom(raw: unknown): EmailPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof EmailPrefs, unknown>>;
  return {
    newOrder: r.newOrder !== false,
    payouts: r.payouts !== false,
  };
}
