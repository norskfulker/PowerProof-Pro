import { notifyChange } from "./local";

/** After a live write, tells subscribed screens (and other tabs) to reload. */
export async function liveChange<T>(p: Promise<T>): Promise<T> {
  const out = await p;
  notifyChange();
  return out;
}
