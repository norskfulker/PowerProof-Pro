import { getDemo } from "../mock/db";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: "network" | "not_found" | "validation" | "conflict" | "limit" = "network"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Every mock call goes through here: adds 300–600ms latency and can be forced to fail
 * from the demo menu, so loading and error states are real.
 * When the backend lands, swap the bodies of the api functions for fetch() calls.
 */
/** Thrown when a Free creator hits a limit; the UI opens the Upgrade dialog on `code: "limit"`. */
export class LimitError extends ApiError {
  constructor(
    public kind: "stores" | "products" | "aiCredits" | "customDomain",
    message: string
  ) {
    super(message, "limit");
  }
}

export async function call<T>(fn: () => T | Promise<T>, opts: { fast?: boolean } = {}): Promise<T> {
  const demo = getDemo();
  const [min, max] = opts.fast ? [80, 160] : demo.latency;
  await new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
  if (demo.fail) throw new ApiError("We couldn't reach PowerProof. Check your connection and try again.");
  // Return a structured clone so callers can't mutate the db by accident
  const out = await fn();
  return out === undefined ? out : (JSON.parse(JSON.stringify(out)) as T);
}

export function notFound(what: string): never {
  throw new ApiError(`${what} not found.`, "not_found");
}
