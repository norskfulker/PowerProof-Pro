/**
 * The dashboard AI assistant's tools: what Gemini may ask for, by name, with its arguments as JSON
 * Schema. The server route (app/api/ai/assistant) only declares them; the browser runs each call
 * through the same lib/api functions the screens use (components/dashboard/ai-assistant.tsx), so
 * the creator's team permissions, database checks and validation apply exactly as in the app.
 */

type Schema = { type: "object"; properties: Record<string, unknown>; required?: string[] };
const obj = (properties: Record<string, unknown>, required: string[] = []): Schema => ({ type: "object", properties, ...(required.length ? { required } : {}) });
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const num = (description: string) => ({ type: "number", description });
const bool = (description: string) => ({ type: "boolean", description });

export const ASSISTANT_TOOLS = {
  get_overview: { description: "The store at a glance: name, link, live or not, currency, what it sells, product counts, today's sales, balance and what needs attention. Call this first when you need context.", parameters: obj({}) },
  get_sales: { description: "Revenue, number of sales and top products for a period.", parameters: obj({ range: str("The period", { enum: ["today", "7d", "30d", "90d"] }) }, ["range"]) },
  list_products: { description: "The store's products with id, title, status, kind, price and what's missing before it can go live.", parameters: obj({ status: str("Filter by status", { enum: ["all", "live", "draft", "archived"] }), search: str("Words in the title") }) },
  create_product: {
    description: "Adds a product as a draft. Digital products need a file and physical ones a collection before they can go live; tell the creator what to add.",
    parameters: obj({ title: str("Product name, 3 to 80 characters"), description: str("What buyers get, at least a full sentence"), price: num("Price in major units of the store's currency, e.g. 499"), kind: str("digital or physical", { enum: ["digital", "physical"] }) }, ["title", "description", "price", "kind"]),
  },
  update_product: {
    description: "Changes a product's title, description, price or compare-at price.",
    parameters: obj({ id: str("Product id from list_products"), title: str("New title"), description: str("New description"), price: num("New price in major units"), compare_at: num("Original price shown crossed out, in major units; 0 removes it") }, ["id"]),
  },
  set_product_status: { description: "Makes a product live, moves it back to drafts, or archives it. Only one kind (digital or physical) can be live at a time in a store.", parameters: obj({ id: str("Product id"), status: str("New status", { enum: ["live", "draft", "archived"] }) }, ["id", "status"]) },
  list_orders: { description: "Recent orders, newest first.", parameters: obj({ status: str("Filter by status", { enum: ["all", "pending", "paid", "cod", "failed", "refunded"] }), to_ship: bool("Only orders waiting to be shipped"), limit: num("How many, up to 25") }) },
  list_customers: { description: "Customers with orders and total spent, biggest spenders first.", parameters: obj({ search: str("Name or email"), limit: num("How many, up to 25") }) },
  create_coupon: {
    description: "Creates a discount code for the whole store.",
    parameters: obj({ code: str("3 to 20 letters or numbers, no spaces"), kind: str("percent or fixed", { enum: ["percent", "fixed"] }), value: num("Percent off (1-90), or the amount off in major units"), expires_at: str("Optional end date, YYYY-MM-DD"), usage_limit: num("Optional number of uses") }, ["code", "kind", "value"]),
  },
  update_store: { description: "Changes store details: name, tagline, support email, refund days, cart reminder emails.", parameters: obj({ name: str("Store name"), tagline: str("One line under the name"), support_email: str("Where buyers write"), refund_days: num("Days buyers can ask for a refund"), cart_reminders: bool("Email buyers who left checkout") }) },
  set_selling: { description: "Switches digital and/or physical products on or off for the store (at least one stays on).", parameters: obj({ digital: bool("Sell digital products"), physical: bool("Sell physical products") }) },
  switch_live_kind: { description: "Switches which kind is live in one step: the live kind's products go to drafts and the other kind's go live (those paused by the last switch, else every ready draft). Use when the creator wants to sell the other kind now.", parameters: obj({ to: str("The kind to make live", { enum: ["digital", "physical"] }) }, ["to"]) },
  publish_store: { description: "Makes the store visible to buyers. Only after the creator clearly asked.", parameters: obj({}) },
  open_page: {
    description: "Offers the creator a button to a page of the app.",
    parameters: obj({ page: str("Which page", { enum: ["dashboard", "analytics", "orders", "customers", "leads", "payouts", "products", "new_product", "collections", "coupons", "store_editor", "store_settings", "marketplace", "billing"] }) }, ["page"]),
  },
} as const satisfies Record<string, { description: string; parameters: Schema }>;

export type AssistantTool = keyof typeof ASSISTANT_TOOLS;
export const isAssistantTool = (name: string): name is AssistantTool => name in ASSISTANT_TOOLS;

/** Tools that change something, shown in the chat as done (the rest only read) */
export const WRITE_TOOLS: ReadonlySet<AssistantTool> = new Set(["create_product", "update_product", "set_product_status", "create_coupon", "update_store", "set_selling", "switch_live_kind", "publish_store"]);

/** One turn of the conversation as Gemini takes it back (model parts go back exactly as they came) */
export interface AssistantContent {
  role: "user" | "model";
  parts: Record<string, unknown>[];
}

export type AssistantReply = { ok: true; content: AssistantContent } | { ok: false; message: string };
