import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavTree } from "@/components/nav/nav-tree";
import { RecordsTable, RECHECK_SECONDS, useCountdown } from "@/components/domains/domain-wizard";
import { StatusPill } from "@/components/pp/status-pill";
import { CREATOR_NAV } from "@/lib/nav/config";
import { resolveNav } from "@/lib/nav/model";
import type { StoreDomain } from "@/lib/types";

const tree = resolveNav(CREATOR_NAV, {
  storeId: "store_ananya",
  counts: { products_all: 17, products_live: 12, reviews_pending: 3 },
  collections: [{ id: "col_a", name: "Notion kits", products: [{ id: "p1", title: "Second Brain" }] }],
  locked: new Set(["customDomain"]),
});

describe("NavTree", () => {
  it("is a tree with the active page's group open (the test path is /dashboard)", () => {
    render(<NavTree tree={tree} area="creator" />);
    expect(screen.getByRole("tree", { name: "Main" })).toBeInTheDocument();
    const dash = screen.getByRole("treeitem", { name: "Dashboard" });
    expect(dash).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("treeitem", { name: "Home" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: "Catalog" })).toHaveAttribute("aria-expanded", "false");
  });

  it("follows the tree keyboard pattern: arrows move, right opens, left closes", async () => {
    render(<NavTree tree={tree} area="creator" />);
    const dash = screen.getByRole("treeitem", { name: "Dashboard" });
    dash.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const catalog = screen.getByRole("treeitem", { name: "Catalog" });
    expect(catalog).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(catalog).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("treeitem", { name: "Products" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(catalog).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(catalog).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("treeitem", { name: "Home" })).toHaveFocus();
  });

  it("only one item is in the tab order (roving tabindex)", () => {
    render(<NavTree tree={tree} area="creator" />);
    const tabbable = screen.getAllByRole("treeitem").filter((el) => el.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });

  it("the quick filter keeps matches and their groups", async () => {
    render(<NavTree tree={tree} area="creator" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter menu" }), "coupons");
    expect(screen.getByRole("treeitem", { name: "Coupons" })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: "Store" })).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: "Dashboard" })).toBeNull();
  });

  it("shows counts and a lock on Pro items", async () => {
    render(<NavTree tree={tree} area="creator" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter menu" }), "domain");
    const lock = screen.getByLabelText("Pro feature");
    expect(lock.closest('[role="treeitem"]')).toHaveTextContent(/^Domain$/);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Filter menu" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter menu" }), "live");
    expect(screen.getByRole("treeitem", { name: /Live/ })).toHaveTextContent("12");
  });
});

describe("Domain wizard parts", () => {
  it("re-checks every 30 seconds with a visible countdown", () => {
    vi.useFakeTimers();
    const check = vi.fn();
    const { result } = renderHook(() => useCountdown(RECHECK_SECONDS, check, true));
    expect(result.current.left).toBe(30);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.left).toBe(20);
    act(() => vi.advanceTimersByTime(20_000));
    expect(check).toHaveBeenCalledTimes(1);
    expect(result.current.left).toBe(30);
    vi.useRealTimers();
  });

  it("shows each record with copy buttons and what's wrong", () => {
    const d: StoreDomain = {
      host: "ananya.in",
      provider: "godaddy",
      auto: true,
      status: "needs_attention",
      issue: "wrong_target",
      records: [{ type: "A", name: "@", value: "76.76.21.21", found: "192.0.2.44" }, { type: "CNAME", name: "www", value: "stores.powerproof.store" }],
      primary: true,
      wwwRedirect: "www_to_root",
      redirectSubdomain: true,
      addedAt: "2026-10-05T00:00:00.000Z",
    };
    render(<RecordsTable domain={d} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/Right now it points to/)).toHaveTextContent("192.0.2.44");
    expect(screen.getAllByRole("button", { name: /copy/i }).length).toBeGreaterThanOrEqual(4);
  });

  it("names every domain status in plain words", () => {
    const labels = ["not_connected", "waiting_dns", "verifying", "issuing_ssl", "connected", "needs_attention"].map((s) => {
      const { container, unmount } = render(<StatusPill status={s} />);
      const t = container.textContent;
      unmount();
      return t;
    });
    expect(labels).toEqual(["Not connected", "Waiting for DNS", "Verifying", "Issuing SSL", "Connected", "Needs attention"]);
  });
});

describe("Theme toggle in the store footer", () => {
  it("switches between light and dark", async () => {
    const { StoreFooter } = await import("@/components/pp/store-footer");
    const onChange = vi.fn();
    render(
      <StoreFooter
        store={{ id: "s", name: "Ananya Makes", slug: "ananya" } as never}
        socials={{}}
        showPoweredBy={false}
        theme={{ mode: "light", onChange }}
      />
    );
    const group = screen.getByRole("group", { name: "Store theme" });
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith("dark");
    expect(group).toBeInTheDocument();
  });
});
