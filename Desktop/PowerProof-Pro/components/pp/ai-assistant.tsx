"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Check, Maximize2, Minimize2, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { publishBlockers } from "@/components/products/readiness";
import { switchSummary } from "@/components/products/switch-live-kind";
import { blankProduct, toInput } from "@/components/products/to-values";
import { useCurrentStore } from "@/hooks/use-current-store";
import {
  createProduct, getBalance, getCustomers, getNavCounts, getOrders, getProducts, getSummary, publishProduct, saveCoupon, switchLiveKind, unpublishProduct, updateProduct, updateStore,
} from "@/lib/api";
import { isAssistantTool, WRITE_TOOLS, type AssistantContent, type AssistantReply, type AssistantTool } from "@/lib/assistant/tools";
import { formatMoney, fromMajor } from "@/lib/money";
import { sellsKind, withKind } from "@/lib/shipping";
import type { OrderStatus, Store } from "@/lib/types";
import { cn } from "@/lib/utils";

type Args = Record<string, unknown>;
type Item = { id: number; kind: "user" | "assistant" | "done" | "error"; text: string } | { id: number; kind: "link"; text: string; href: string };

/**
 * Ideas for the chips, mixed so neighbours differ. Four show at a time and move on to the next four
 * after every message and every few seconds, so nothing repeats until the whole list has shown.
 */
const SUGGESTIONS = [
  "How did I do this week?", "What needs my attention?", "Create a 10% off code called WELCOME10", "Add a digital product",
  "Which product sells best?", "Show my last 5 orders", "Is my store live?", "Who are my top customers?",
  "Which drafts are ready to go live?", "Compare this month with last month", "Make a code for 200 off, valid till month end", "Change my tagline",
  "What did I earn today?", "Orders waiting to be shipped", "Turn on physical products", "How much can I withdraw?",
  "Raise the price of my best seller by 10%", "Write a better description for my newest product", "Any failed payments lately?", "Add a physical product",
  "How many sales in the last 90 days?", "Archive products that never sold", "Switch on cart reminder emails", "What should I do next to grow?",
  "Set my refund window to 14 days", "List my live products", "Create a one-time code FLASH25 for 25% off", "Put my store live",
  "Which customers bought more than once?", "Update my support email", "How are visitors turning into buyers?", "Take my old products back to drafts",
  "Give me a quick summary of my store", "Show refunded orders", "Make a launch code limited to 50 uses", "Rename my store",
];
const CHIPS = 4;
const ROTATE_MS = 9000;
const chipsAt = (n: number) => Array.from({ length: CHIPS }, (_, i) => SUGGESTIONS[(n * CHIPS + i) % SUGGESTIONS.length]);
const MAX_STEPS = 8;

/** Where open_page may send the creator */
const PAGES: Record<string, { label: string; href: (s: Store) => string }> = {
  dashboard: { label: "Dashboard", href: () => "/dashboard" },
  analytics: { label: "Analytics", href: () => "/analytics" },
  orders: { label: "Orders", href: () => "/sales/orders" },
  customers: { label: "Customers", href: () => "/sales/customers" },
  leads: { label: "Leads", href: () => "/sales/leads" },
  payouts: { label: "Payouts", href: () => "/sales/payouts/balance" },
  products: { label: "Products", href: () => "/catalog/products" },
  new_product: { label: "Add a product", href: () => "/catalog/products/new" },
  collections: { label: "Collections", href: () => "/catalog/collections" },
  coupons: { label: "Coupons", href: (s) => `/store/${s.id}/offers/coupons` },
  store_editor: { label: "Theme editor", href: (s) => `/store/${s.id}/design/pages/home/edit` },
  store_settings: { label: "Store settings", href: (s) => `/store/${s.id}/settings` },
  marketplace: { label: "Marketplace", href: () => "/marketplace" },
  billing: { label: "Billing and plan", href: () => "/settings/billing" },
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const numOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const limitOf = (v: unknown) => Math.min(25, Math.max(1, Math.round(numOf(v) ?? 10)));
const STATUS: Record<string, "published" | "draft" | "archived"> = { live: "published", draft: "draft", archived: "archived" };

/**
 * Runs one tool call as the signed-in creator, through lib/api (the same checks as the screens).
 * Returns what the model reads back, plus a line for the chat when something changed or a link.
 */
async function runTool(name: AssistantTool, a: Args, store: Store): Promise<{ response: Args; note?: string; link?: { text: string; href: string } }> {
  const m = (n: number) => fromMajor(n, store.currency);
  switch (name) {
    case "get_overview": {
      const [products, today, balance, nav] = await Promise.all([getProducts(), getSummary("today"), getBalance(), getNavCounts("creator")]);
      const by = (s: string) => products.filter((p) => p.status === s).length;
      return {
        response: {
          name: store.name, link: `${location.origin}/s/${store.slug}`, live: store.onboarded, currency: store.currency, sells: store.sells,
          products: { live: by("published"), drafts: by("draft"), archived: by("archived") },
          today: { revenue: formatMoney(today.revenue), sales: today.sales },
          balance: { available: formatMoney(balance.available), pending: formatMoney(balance.pending) },
          needsAttention: nav.counts,
        },
      };
    }
    case "get_sales": {
      const range = (["today", "7d", "30d", "90d"] as const).find((r) => r === a.range) ?? "7d";
      const s = await getSummary(range);
      return { response: { period: s.period, revenue: formatMoney(s.revenue), sales: s.sales, visitors: s.visitors, changeVsBefore: s.deltas, topProducts: s.topProducts.slice(0, 5).map((p) => ({ title: p.title, sales: p.sales, revenue: formatMoney(p.revenue) })) } };
    }
    case "list_products": {
      const status = STATUS[String(a.status)];
      const list = await getProducts({ status: status ?? "all", search: str(a.search) });
      return { response: { products: list.slice(0, 40).map((p) => ({ id: p.id, title: p.title, status: p.status === "published" ? "live" : p.status, kind: p.fulfilment, price: formatMoney(p.price), sales: p.salesCount, missingBeforeLive: p.status === "draft" ? publishBlockers(p, true) : [] })), total: list.length } };
    }
    case "create_product": {
      const kind = a.kind === "physical" ? "physical" : "digital";
      if (!sellsKind(store.sells, kind)) return { response: { error: `${kind === "physical" ? "Physical" : "Digital"} products are switched off for this store. Use set_selling to switch them on first.` } };
      const title = str(a.title) ?? "";
      const price = numOf(a.price) ?? 0;
      const p = await createProduct(toInput({ ...blankProduct(kind, store.currency), title, description: str(a.description) ?? "", price: m(price) }));
      return { response: { id: p.id, title: p.title, status: "draft", next: kind === "digital" ? "Upload the file buyers download, then make it live." : "Add it to a collection, then make it live." }, note: `Added “${p.title}” as a draft`, link: { text: `Open ${p.title}`, href: `/catalog/products/${p.id}` } };
    }
    case "update_product": {
      const id = str(a.id);
      if (!id) return { response: { error: "Which product? Use list_products for its id." } };
      const price = numOf(a.price);
      const compare = numOf(a.compare_at);
      const p = await updateProduct(id, {
        ...(str(a.title) ? { title: str(a.title) } : {}),
        ...(str(a.description) ? { description: str(a.description) } : {}),
        ...(price !== undefined ? { price: m(price) } : {}),
        ...(compare !== undefined ? { compareAt: compare > 0 ? m(compare) : undefined } : {}),
      });
      return { response: { id: p.id, title: p.title, price: formatMoney(p.price), compareAt: p.compareAt ? formatMoney(p.compareAt) : null }, note: `Updated “${p.title}”` };
    }
    case "set_product_status": {
      const id = str(a.id);
      if (!id) return { response: { error: "Which product? Use list_products for its id." } };
      const p = a.status === "live" ? await publishProduct(id) : a.status === "archived" ? await updateProduct(id, { status: "archived" }) : await unpublishProduct(id);
      const word = p.status === "published" ? "live" : p.status === "archived" ? "archived" : "a draft";
      return { response: { id: p.id, title: p.title, status: word }, note: `“${p.title}” is ${word}` };
    }
    case "list_orders": {
      const status = (["pending", "paid", "cod", "failed", "refunded"] as const).find((s) => s === a.status) as OrderStatus | undefined;
      const list = await getOrders({ status: status ?? "all", toShip: a.to_ship === true || undefined });
      return { response: { orders: list.slice(0, limitOf(a.limit)).map((o) => ({ number: o.number, date: o.createdAt, buyer: o.buyerName, items: o.items.map((i) => i.title).join(", ") || o.productTitle, total: formatMoney(o.buyerTotal), status: o.status, fulfilment: o.fulfilment ?? null })), total: list.length } };
    }
    case "list_customers": {
      const list = (await getCustomers({ search: str(a.search) })).sort((x, y) => y.totalSpent.amount - x.totalSpent.amount);
      return { response: { customers: list.slice(0, limitOf(a.limit)).map((c) => ({ name: c.name, email: c.email, country: c.country, orders: c.ordersCount, spent: formatMoney(c.totalSpent), lastOrder: c.lastOrderAt })), total: list.length } };
    }
    case "create_coupon": {
      const kind = a.kind === "fixed" ? "fixed" : "percent";
      const value = numOf(a.value) ?? 0;
      const ends = str(a.expires_at);
      const code = (str(a.code) ?? "").toUpperCase();
      await saveCoupon({ code, kind, value: kind === "percent" ? Math.round(value) : m(value).amount, expiresAt: ends && /^\d{4}-\d{2}-\d{2}$/.test(ends) ? new Date(`${ends}T23:59:59+05:30`).toISOString() : undefined, usageLimit: numOf(a.usage_limit) ? Math.round(numOf(a.usage_limit)!) : undefined, scope: "store", productIds: [], active: true });
      return { response: { code, ok: true }, note: `Created code ${code}`, link: { text: "Open coupons", href: PAGES.coupons.href(store) } };
    }
    case "update_store": {
      const refund = numOf(a.refund_days);
      const patch: Partial<Store> = {
        ...(str(a.name) ? { name: str(a.name) } : {}),
        ...(typeof a.tagline === "string" ? { tagline: a.tagline.trim() } : {}),
        ...(str(a.support_email) ? { supportEmail: str(a.support_email) } : {}),
        ...(refund !== undefined ? { refundDays: Math.round(refund) } : {}),
        ...(typeof a.cart_reminders === "boolean" ? { cartReminders: a.cart_reminders } : {}),
      };
      if (!Object.keys(patch).length) return { response: { error: "Nothing to change." } };
      await updateStore(patch);
      return { response: { ok: true, changed: Object.keys(patch) }, note: "Updated your store details" };
    }
    case "set_selling": {
      let sells = store.sells;
      if (typeof a.digital === "boolean") sells = withKind(sells, "digital", a.digital);
      if (typeof a.physical === "boolean") sells = withKind(sells, "physical", a.physical);
      if (sells === store.sells) return { response: { sells, note: "Already set like that (at least one kind stays on)." } };
      await updateStore({ sells });
      return { response: { sells }, note: sells === "both" ? "Selling digital and physical products" : `Selling ${sells} products only` };
    }
    case "switch_live_kind": {
      const to = a.to === "physical" ? "physical" : "digital";
      const r = await switchLiveKind(to);
      return { response: { ...r }, note: `Switched to ${to}: ${switchSummary(r)}` };
    }
    case "publish_store": {
      if (store.onboarded) return { response: { live: true, note: "Already live." } };
      await updateStore({ onboarded: true });
      return { response: { live: true, link: `${location.origin}/s/${store.slug}` }, note: "Your store is live", link: { text: "View your store", href: `/s/${store.slug}` } };
    }
    case "open_page": {
      const page = PAGES[String(a.page)];
      if (!page) return { response: { error: "Unknown page." } };
      return { response: { ok: true }, link: { text: `Open ${page.label}`, href: page.href(store) } };
    }
  }
}

const textOf = (c: AssistantContent) => c.parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("").trim();
const callsOf = (c: AssistantContent) => c.parts.map((p) => p.functionCall as { id?: string; name?: string; args?: Args } | undefined).filter((f): f is { id?: string; name: string; args?: Args } => !!f?.name);

/** Today in India, for "this week" and dates in codes */
const today = () => new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/* ------------------------------------------------------------------ */
/* Panel state: open, closed or full screen, and its width               */
/* ------------------------------------------------------------------ */

export type AiPanelMode = "closed" | "open" | "full";
const PANEL_KEY = "pp:ai-panel";
const MIN_W = 340;
const MAX_W = 760;
const DEFAULT_W = 420;
const clampW = (w: number) => Math.round(Math.min(MAX_W, Math.max(MIN_W, w)));

/** One shared state for the panel, the top-bar button and the app shell (kept on this device) */
let panel: { mode: AiPanelMode; width: number } | undefined;
const panelListeners = new Set<() => void>();
const SERVER_PANEL = { mode: "closed" as AiPanelMode, width: DEFAULT_W };
function readPanel() {
  if (panel) return panel;
  try {
    const v = JSON.parse(localStorage.getItem(PANEL_KEY) ?? "{}") as { open?: boolean; width?: number };
    panel = { mode: v.open ? "open" : "closed", width: clampW(v.width ?? DEFAULT_W) };
  } catch {
    panel = { ...SERVER_PANEL };
  }
  return panel;
}
function writePanel(next: Partial<{ mode: AiPanelMode; width: number }>) {
  panel = { ...readPanel(), ...next };
  try {
    // Full screen is for now: next visit opens as the side panel
    localStorage.setItem(PANEL_KEY, JSON.stringify({ open: panel.mode !== "closed", width: panel.width }));
  } catch {
    /* storage blocked: the panel still works for this visit */
  }
  panelListeners.forEach((l) => l());
}

/** The AI panel's state and controls, for the shell and the top bar */
export function useAiPanel() {
  const state = useSyncExternalStore((cb) => (panelListeners.add(cb), () => panelListeners.delete(cb)), readPanel, () => SERVER_PANEL);
  return {
    ...state,
    open: () => writePanel({ mode: "open" }),
    close: () => writePanel({ mode: "closed" }),
    toggle: () => writePanel({ mode: readPanel().mode === "closed" ? "open" : "closed" }),
    toggleFull: () => writePanel({ mode: readPanel().mode === "full" ? "open" : "full" }),
    setWidth: (w: number) => writePanel({ width: clampW(w) }),
  };
}

/** Opens and closes the panel (⌘J / Ctrl+J does the same from anywhere). `floating`: a solid round button. */
export function AiPanelButton({ className, floating = false }: { className?: string; floating?: boolean }) {
  const ai = useAiPanel();
  const on = ai.mode !== "closed";
  return (
    <Button variant={floating ? "primary" : on ? "secondary" : "ghost"} size="sm" onClick={ai.toggle} aria-pressed={on} aria-label={on ? "Close PowerProof AI" : "Open PowerProof AI"} title="PowerProof AI (⌘J)" className={className}>
      <Sparkles className={floating ? undefined : "text-primary"} aria-hidden /> <span className="max-sm:sr-only">Ask AI</span>
    </Button>
  );
}

/** Dots behind the conversation, in the border colour so they follow the theme */
const DOTS = "bg-[radial-gradient(color-mix(in_oklab,var(--muted-foreground)_28%,transparent)_1px,transparent_1px)] [background-size:18px_18px]";

/**
 * PowerProof AI, on the right of every creator page: ask about the store and get things done
 * (products, codes, store details, going live) in plain words. It collapses away, widens by
 * dragging its edge, and goes full screen. Gemini plans through app/api/ai/assistant; every action
 * runs here through lib/api as the creator, so it can only do what they could do on the screens.
 * The conversation stays while the panel is closed and while moving between pages.
 */
export function AiPanel() {
  const ai = useAiPanel();
  const store = useCurrentStore().data;
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<AssistantContent[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string>();
  // Which set of chips shows; moves on after each message and on a timer while idle and visible
  const [round, setRound] = useState(0);
  const typing = text.trim().length > 0;
  const visible = ai.mode !== "closed";
  useEffect(() => {
    if (busy || typing || !visible) return;
    const t = setInterval(() => setRound((r) => r + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [busy, typing, visible]);
  const stop = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [items, busy]);
  // ⌘J / Ctrl+J opens and closes the panel from any page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        writePanel({ mode: readPanel().mode === "closed" ? "open" : "closed" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Opening puts the cursor in the chatbox; Escape leaves full screen
  useEffect(() => {
    if (!visible) return;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (readPanel().mode === "full") writePanel({ mode: "open" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const add = (...more: Omit<Item, "id">[]) => setItems((xs) => [...xs, ...more.map((x) => ({ ...x, id: ++seq.current }) as Item)]);

  async function send(message: string) {
    const ask = message.trim();
    if (!ask || busy || !store) return;
    setText("");
    setRound((r) => r + 1);
    add({ kind: "user", text: ask });
    const ctl = new AbortController();
    stop.current = ctl;
    let contents: AssistantContent[] = [...history, { role: "user", parts: [{ text: ask }] }];
    setBusy("Thinking");
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const res = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents, store: { name: store.name, currency: store.currency, sells: store.sells, live: store.onboarded, today: today() } }),
          signal: ctl.signal,
        });
        const reply = (await res.json().catch(() => ({ ok: false, message: "The assistant didn't answer. Try again." }))) as AssistantReply;
        if (!reply.ok) {
          add({ kind: "error", text: reply.message });
          // Keep what was said, minus the unanswered question, so the next message starts clean
          return;
        }
        contents = [...contents, reply.content];
        const said = textOf(reply.content);
        if (said) add({ kind: "assistant", text: said });
        const calls = callsOf(reply.content);
        if (!calls.length) break;
        const answers: Record<string, unknown>[] = [];
        for (const call of calls) {
          setBusy(isAssistantTool(call.name) && WRITE_TOOLS.has(call.name) ? "Working on it" : "Looking at your store");
          let out: Awaited<ReturnType<typeof runTool>>;
          try {
            out = isAssistantTool(call.name) ? await runTool(call.name, call.args ?? {}, store) : { response: { error: "Unknown tool." } };
          } catch (e) {
            out = { response: { error: e instanceof Error ? e.message : "That didn't work." } };
          }
          if (out.note) add({ kind: "done", text: out.note });
          if (out.link) add({ kind: "link", ...out.link });
          answers.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: out.response } });
        }
        contents = [...contents, { role: "user", parts: answers }];
        setBusy("Thinking");
      }
      setHistory(contents);
    } catch (e) {
      if (!ctl.signal.aborted) add({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong. Try again." });
      else add({ kind: "error", text: "Stopped." });
    } finally {
      // A conversation always ends on the model's turn: drop a trailing unanswered tool result
      if (contents[contents.length - 1]?.role === "model") setHistory(contents);
      stop.current = null;
      setBusy(undefined);
    }
  }

  /** Drag the left edge to widen or narrow the panel */
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = ai.width;
    const move = (ev: PointerEvent) => ai.setWidth(startW + (startX - ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const empty = items.length === 0;
  const full = ai.mode === "full";
  const column = full ? "mx-auto w-full max-w-3xl" : "w-full";
  return (
    <aside
      aria-label="PowerProof AI"
      hidden={!visible}
      className={cn(
        "z-40 flex flex-col bg-surface",
        // Phones: over the page. Desktop: a column beside it, or the whole window in full screen.
        full ? "fixed inset-0 z-50" : "fixed inset-0 md:sticky md:top-0 md:z-20 md:h-dvh md:border-l"
      )}
    >
      {!full && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize PowerProof AI"
          aria-valuemin={MIN_W}
          aria-valuemax={MAX_W}
          aria-valuenow={ai.width}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") ai.setWidth(ai.width + 24);
            if (e.key === "ArrowRight") ai.setWidth(ai.width - 24);
          }}
          className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize outline-none md:block"
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
        </div>
      )}

      <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-surface/90 px-4 backdrop-blur">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm"><Sparkles className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="font-sans text-sm font-semibold tracking-normal">PowerProof AI</h2>
          <p className="truncate text-xs text-muted-foreground">{busy ? `${busy}…` : store ? `Working on ${store.name}` : "Your store assistant"}</p>
        </div>
        <Button variant="ghost" size="icon-sm" disabled={empty || !!busy} onClick={() => { setItems([]); setHistory([]); }} aria-label="New chat" title="New chat"><RotateCcw aria-hidden /></Button>
        <Button variant="ghost" size="icon-sm" onClick={ai.toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen (Esc)" : "Full screen"} className="max-md:hidden">
          {full ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={ai.close} aria-label="Close PowerProof AI" title="Close (⌘J)"><X aria-hidden /></Button>
      </header>

      <div ref={list} role="log" aria-live="polite" className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-sunken/40", DOTS)}>
        <div className={cn("flex min-h-full flex-col gap-4 px-4 py-5", column)}>
          {empty ? (
            <div className="m-auto flex max-w-xs flex-col items-center gap-3 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface text-primary shadow-sm ring-1 ring-border"><Sparkles className="size-5" aria-hidden /></span>
              <p className="font-display text-xl">How can I help?</p>
              <p className="text-sm text-muted-foreground">Ask about sales, or tell me to add products, make codes, update your store or put it live.</p>
            </div>
          ) : (
            items.map((it) =>
              it.kind === "user" ? (
                <p key={it.id} className="max-w-[85%] self-end rounded-[1.25rem] rounded-br-md bg-primary px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-sm">{it.text}</p>
              ) : it.kind === "assistant" ? (
                <div key={it.id} className="flex max-w-[92%] gap-2.5 self-start">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Sparkles className="size-3" aria-hidden /></span>
                  <p className="rounded-[1.25rem] rounded-tl-md border bg-surface px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap shadow-sm">{it.text}</p>
                </div>
              ) : it.kind === "done" ? (
                <p key={it.id} className="ml-8 inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success"><Check className="size-3.5" aria-hidden /> {it.text}</p>
              ) : it.kind === "link" ? (
                <Link key={it.id} href={it.href} onClick={() => full && ai.toggleFull()} className="ml-8 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full border bg-surface px-3.5 text-sm font-medium text-primary shadow-sm transition-colors hover:border-primary">{it.text} <ArrowRight className="size-3.5" aria-hidden /></Link>
              ) : (
                <p key={it.id} role="alert" className="ml-8 w-fit rounded-media bg-warning-soft px-3 py-2 text-sm text-warning-ink">{it.text}</p>
              )
            )
          )}
          {busy && (
            <p className="ml-8 inline-flex w-fit items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
              <span className="flex gap-1" aria-hidden>
                {[0, 150, 300].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-primary/60 motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />)}
              </span>
              {busy}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t bg-surface pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className={cn("flex flex-col gap-2.5 px-3", column)}>
          {/* Ideas to start from: always there, a new set after every message */}
          <ul className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]" aria-label="Try asking">
            {chipsAt(round).map((s) => (
              <li key={`${round}-${s}`} className="shrink-0 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
                <button type="button" onClick={() => void send(s)} disabled={!store || !!busy} className="inline-flex min-h-8 items-center rounded-full border bg-surface px-3 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:opacity-50 pointer-coarse:min-h-11">
                  {s}
                </button>
              </li>
            ))}
          </ul>
          {/* The chatbox: the message and the send button in one box */}
          <form
            className="relative rounded-[1.25rem] border bg-surface shadow-sm transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-md"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <Textarea
              ref={box}
              size="sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Ask anything, or tell AI what to do…"
              aria-label="Message PowerProof AI"
              className="resize-none rounded-[1.25rem] border-0 bg-transparent pr-14 pl-4 text-[0.9375rem] hover:border-0 focus-visible:outline-none"
              disabled={!store}
            />
            <div className="absolute right-2 bottom-2">
              {busy ? (
                <Button type="button" variant="secondary" size="icon-sm" className="rounded-full" aria-label="Stop" onClick={() => stop.current?.abort()}><Square className="fill-current" aria-hidden /></Button>
              ) : (
                <Button type="submit" size="icon-sm" className="rounded-full" aria-label="Send" disabled={!text.trim() || !store}><ArrowUp aria-hidden /></Button>
              )}
            </div>
          </form>
          <p className="text-center text-[0.6875rem] text-muted-foreground">AI can make mistakes. Changes it makes are real.</p>
        </div>
      </div>
    </aside>
  );
}
