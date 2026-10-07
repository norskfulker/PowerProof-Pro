import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavTree } from "@/components/nav/nav-tree";
import { StatusPill } from "@/components/pp/status-pill";
import { CREATOR_NAV } from "@/lib/nav/config";
import { resolveNav } from "@/lib/nav/model";

const tree = resolveNav(CREATOR_NAV, {
  storeId: "store_fx",
  counts: { products_all: 17, products_live: 12, reviews_pending: 3 },
  collections: [{ id: "col_a", name: "Fixture collection", products: [{ id: "p1", title: "Fixture product" }] }],
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
    expect(screen.getByRole("treeitem", { name: /^Collections/ })).toHaveFocus();
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

describe("Domain status labels", () => {
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
        store={{ id: "s", name: "Fixture Store", slug: "fixture-store" } as never}
        socials={{}}
        showPoweredBy={false}
        theme={{ mode: "light", onChange }}
      />
    );
    const group = screen.getByRole("radiogroup", { name: "Store colour mode" });
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith("dark");
    expect(group).toBeInTheDocument();
  });
});
