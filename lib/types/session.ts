export interface Session {
  name: string;
  email: string;
  storeId: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
