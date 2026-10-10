export class ApiError extends Error {
  constructor(
    message: string,
    public code: "network" | "not_found" | "validation" | "conflict" | "limit" = "network"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when a Free creator hits a limit; the UI opens the Upgrade dialog on `code: "limit"`. */
export class LimitError extends ApiError {
  constructor(
    public kind: "stores" | "products" | "pages" | "aiCredits" | "customDomain",
    message: string
  ) {
    super(message, "limit");
  }
}

export function notFound(what: string): never {
  throw new ApiError(`${what} not found.`, "not_found");
}
