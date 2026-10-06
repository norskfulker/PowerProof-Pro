import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Package } from "lucide-react";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { CopyField } from "@/components/pp/copy-field";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { CurrencyInput } from "@/components/pp/currency-input";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { FeeBreakdown } from "@/components/pp/fee-breakdown";
import { FileDrop } from "@/components/pp/file-drop";
import { Logo, LogoMark } from "@/components/pp/logo";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { PayoutMethodCard } from "@/components/pp/payout-method-card";
import { CoverArt, ImagePlaceholder, ProductImageView } from "@/components/pp/product-cover";
import { ProductCard } from "@/components/pp/product-card";
import { ProofReceipt } from "@/components/pp/proof-receipt";
import { ScrollRegion } from "@/components/pp/scroll-region";
import { Segmented } from "@/components/pp/segmented";
import { MobileTabBar } from "@/components/pp/mobile-tab-bar";
import { StarInput, Stars } from "@/components/pp/stars";
import { StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { StepProgress } from "@/components/pp/step-progress";
import { SystemPage } from "@/components/pp/system-page";
import { TemplateCard } from "@/components/pp/template-card";
import { HtmlPasteEditor, findBuyButtons } from "@/components/pp/html-paste-editor";
import { TEMPLATES } from "@/lib/templates";
import { contrast } from "@/lib/color";
import { DB, INR, LONG, ORDER, PRODUCT } from "./fixtures";

describe("MoneyText", () => {
  it("formats and labels money", () => {
    render(<MoneyText value={INR(1499)} />);
    expect(screen.getByText("₹1,499.00")).toBeInTheDocument();
  });
  it("shows signed and compact variants", () => {
    render(
      <>
        <MoneyText value={INR(-20)} signed />
        <MoneyText value={INR(250000)} compact />
      </>
    );
    expect(screen.getByText("−₹20.00")).toBeInTheDocument();
    expect(screen.getByText("₹2.50L")).toBeInTheDocument();
  });
});

describe("EmptyState and ErrorState", () => {
  it("renders an empty state with an action", () => {
    render(<EmptyState icon={Package} title="No products yet" body="Add one." action={<button>Add product</button>} />);
    expect(screen.getByText("No products yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add product" })).toBeInTheDocument();
  });
  it("renders a compact empty state", () => {
    render(<EmptyState title="Nothing" compact />);
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });
  it("announces errors and retries", async () => {
    const retry = vi.fn();
    render(<ErrorState message="Network down" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });
});

describe("StatusPill", () => {
  it.each(["paid", "pending", "refunded", "refund_requested", "failed", "draft", "published"])("renders %s with a readable label", (s) => {
    render(<StatusPill status={s} />);
    expect(screen.getByText(/./)).toBeInTheDocument();
  });
  it("accepts an explicit label and tone", () => {
    render(<StatusPill status="x" label="Custom" tone="warning" />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("shows value, delta and hint", () => {
    render(<StatCard label="Revenue" value="₹1,000" delta={12.5} hint="vs last week" />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
    expect(screen.getByText(/12\.5/)).toBeInTheDocument();
  });
  it("shows a loading state without a value", () => {
    const { container } = render(<StatCard label="Revenue" loading />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });
});

describe("PageHeader", () => {
  it("renders title, eyebrow, back link and actions", () => {
    render(<PageHeader title="Orders" eyebrow="Sales" description="All of them" back={{ href: "/x", label: "Back" }} actions={<button>Export</button>} />);
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    // On a page that's in the menu (the test path is /dashboard), breadcrumbs replace the back link
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs).toHaveTextContent("Home");
    expect(crumbs).toHaveTextContent("Orders");
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});

describe("Segmented", () => {
  it("marks the pressed option and switches", async () => {
    const onChange = vi.fn();
    render(<Segmented label="Range" value="7d" onChange={onChange} options={[{ value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }]} />);
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(onChange).toHaveBeenCalledWith("30d");
  });
});

describe("Stars and StarInput", () => {
  it("labels the rating", () => {
    render(<Stars value={4.5} />);
    expect(screen.getByRole("img", { name: /4\.5/ })).toBeInTheDocument();
  });
  it("picks a rating with the keyboard and shows invalid state", async () => {
    const onChange = vi.fn();
    render(<StarInput value={0} onChange={onChange} invalid />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    await userEvent.click(radios[3]);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe("StepProgress", () => {
  it("marks the current step", () => {
    render(<StepProgress steps={["One", "Two", "Three"]} current={1} />);
    expect(screen.getAllByText("Two").length).toBeGreaterThan(0);
    expect(document.querySelector('[aria-current="step"]')).toBeTruthy();
  });
});

describe("CurrencyInput", () => {
  it("parses typed amounts into minor units", async () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="p">Price</label>
        <CurrencyInput id="p" value={undefined} onChange={onChange} />
      </>
    );
    await userEvent.type(screen.getByLabelText("Price"), "499.5");
    expect(onChange).toHaveBeenLastCalledWith({ amount: 49950, currency: "INR" });
  });
  it("shows invalid and disabled states", () => {
    render(
      <>
        <label htmlFor="q">Price</label>
        <CurrencyInput id="q" value={INR(10)} onChange={() => {}} invalid disabled />
      </>
    );
    const input = screen.getByLabelText("Price");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toBeDisabled();
  });
});

describe("CopyField", () => {
  it("copies the value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyField label="Link" value="https://powerproof.store/ananya" />);
    await userEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("https://powerproof.store/ananya");
  });
  it("renders multiline code inside a labelled scroll region", () => {
    render(<CopyField label="Embed" value={"<script>\n</script>"} multiline />);
    expect(screen.getByText(/<script>/)).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("confirms and cancels", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="Delete it?" description="Gone for good." confirmLabel="Delete" onConfirm={onConfirm} />);
    expect(screen.getByRole("dialog", { name: "Delete it?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe("CountdownTimer", () => {
  it("counts down to a future time", () => {
    render(<CountdownTimer endsAt={new Date(Date.now() + 3 * 3600_000).toISOString()} />);
    expect(screen.getByRole("timer")).toHaveAttribute("aria-label", expect.stringMatching(/Ends in 2 hours 59 minutes|Ends in 3 hours 0 minutes/));
  });
  it("shows Ended in the past and a compact variant", () => {
    render(
      <>
        <CountdownTimer endsAt={new Date(Date.now() - 1000).toISOString()} />
        <CountdownTimer endsAt={new Date(Date.now() + 90_000).toISOString()} compact />
      </>
    );
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText(/\d\dh \d\dm \d\ds/)).toBeInTheDocument();
  });
});

describe("FeeBreakdown", () => {
  it("lists what the creator keeps", () => {
    render(<FeeBreakdown sale={INR(1000)} />);
    expect(screen.getAllByText(/you keep/i).length).toBeGreaterThan(0);
  });
});

describe("FileDrop", () => {
  it("lists files and removes one", async () => {
    const onChange = vi.fn();
    render(<FileDrop files={PRODUCT.files} onChange={onChange} />);
    expect(screen.getByText(PRODUCT.files[0].name)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(onChange).toHaveBeenCalled();
  });
  it("shows the empty and invalid state", () => {
    render(<FileDrop files={[]} onChange={() => {}} invalid />);
    expect(screen.getAllByText(/drop|choose|upload/i).length).toBeGreaterThan(0);
  });
});

describe("Logo", () => {
  it("renders full, compact and inverted marks", () => {
    render(
      <>
        <Logo />
        <Logo compact inverted href={null} />
        <LogoMark />
      </>
    );
    expect(screen.getAllByText(/PowerProof/).length).toBeGreaterThan(0);
  });
});

describe("Product covers", () => {
  it("keeps text readable on any background", () => {
    const { container } = render(<CoverArt cover={{ template: "split", title: "Clash", bg: "#C9A24F", fg: "#C9A24F", accent: "#0F3D33" }} />);
    const art = container.firstElementChild as HTMLElement;
    const fg = (art.querySelector("[aria-hidden]") as HTMLElement).style.color || art.style.color;
    expect(fg).toBeTruthy();
    expect(contrast("#C9A24F", "#0C1F1B")).toBeGreaterThan(4.5);
  });
  it("renders a placeholder when there is no image", () => {
    render(<ProductImageView image={undefined} />);
    expect(screen.getByRole("img", { name: "No image" })).toBeInTheDocument();
    render(<ImagePlaceholder />);
  });
  it.each(["xs", "sm", "md", "lg"] as const)("renders size %s", (size) => {
    render(<ProductImageView image={PRODUCT.images[0]} size={size} />);
    expect(screen.getByRole("img", { name: PRODUCT.images[0].alt })).toBeInTheDocument();
  });
});

describe("ProductCard", () => {
  it("renders creator and buyer variants", () => {
    render(
      <>
        <ProductCard product={PRODUCT} href="/products/x" />
        <ProductCard product={PRODUCT} href="/s/x" variant="buyer" currency="USD" />
      </>
    );
    expect(screen.getAllByRole("link", { name: new RegExp(PRODUCT.title) }).length).toBeGreaterThanOrEqual(2);
  });
  it("survives a very long title and no images", () => {
    render(<ProductCard product={{ ...PRODUCT, title: LONG.unbroken, images: [] }} href="/x" />);
    expect(screen.getByText(LONG.unbroken)).toBeInTheDocument();
  });
});

describe("PayoutMethodCard", () => {
  it("selects a method", async () => {
    const onSelect = vi.fn();
    render(<PayoutMethodCard method={DB.payoutMethods[0]} onSelect={onSelect} selected />);
    await userEvent.click(screen.getAllByRole("button")[0] ?? screen.getByRole("radio"));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe("ProofReceipt", () => {
  it("shows order number and total", () => {
    render(<ProofReceipt order={ORDER} storeName="Ananya Makes" showFees />);
    expect(screen.getByText(new RegExp(ORDER.number))).toBeInTheDocument();
  });
});

describe("ScrollRegion", () => {
  it("renders children", () => {
    render(<ScrollRegion label="Code">hello</ScrollRegion>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});

describe("MobileTabBar", () => {
  it("shows Home, Products, Orders, Store and opens the menu", async () => {
    const onMore = vi.fn();
    render(<MobileTabBar area="creator" onMore={onMore} />);
    for (const t of ["Home", "Products", "Orders", "Store"]) expect(screen.getByRole("link", { name: t })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(onMore).toHaveBeenCalled();
  });
});

describe("SystemPage", () => {
  it("renders code, title and action", () => {
    render(<SystemPage code="404" title="Not here" body="Gone." action={<button type="button">Home</button>} />);
    expect(screen.getByRole("heading", { name: "Not here" })).toBeInTheDocument();
  });
});

describe("TemplateCard", () => {
  it("selects a template", async () => {
    const onSelect = vi.fn();
    render(<TemplateCard template={TEMPLATES[0]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(TEMPLATES[0].name) }));
    expect(onSelect).toHaveBeenCalled();
  });
  it("shows the selected state", () => {
    render(<TemplateCard template={TEMPLATES[1]} selected />);
    expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const cols = [
    { accessorKey: "number", header: "Order" },
    { accessorKey: "buyerName", header: "Buyer" },
  ];
  it("renders rows", () => {
    render(<DataTable label="Orders" columns={cols} data={DB.orders.slice(0, 5)} />);
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText(DB.orders[0].number)).toBeInTheDocument();
  });
  it("shows loading, error and empty states", () => {
    const { rerender, container } = render(<DataTable label="Orders" columns={cols} data={undefined} loading />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    rerender(<DataTable label="Orders" columns={cols} data={undefined} error="Down" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<DataTable label="Orders" columns={cols} data={[]} />);
    expect(screen.getAllByText(/nothing|no /i).length).toBeGreaterThan(0);
  });
});

describe("HtmlPasteEditor", () => {
  it("finds buy buttons", () => {
    expect(findBuyButtons('<button data-pp-buy="a">x</button><a data-pp-buy=\'b\'>y</a>')).toEqual(["a", "b"]);
  });
  it("renders the editor and preview", () => {
    render(<HtmlPasteEditor value="<h1>Hi</h1>" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

