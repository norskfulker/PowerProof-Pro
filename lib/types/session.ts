export interface Session {
  name: string;
  email: string;
  /** Empty until the first store is created in onboarding */
  storeId: string;
  /** Set when sign-up needs the emailed code before there is a session */
  needsVerification?: boolean;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
