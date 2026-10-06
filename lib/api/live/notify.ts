import { notifyChange } from "../../mock/db";

/** After a live write, tells subscribed screens (and other tabs) to reload, as the mock did. */
export async function liveChange<T>(p: Promise<T>): Promise<T> {
  const out = await p;
  notifyChange();
  return out;
}
