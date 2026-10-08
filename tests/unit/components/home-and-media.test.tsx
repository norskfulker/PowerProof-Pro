import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { StatusTabs } from "@/components/pp/status-tabs";
import { HtmlSection, htmlDocument } from "@/components/storefront/html-section";
import { PreviewPicker } from "@/components/storefront/store-shell";
import { checkHtmlFile, HTML_MAX_BYTES, HtmlEditor } from "@/components/store-admin/html-editor";
import { storageState } from "@/components/media/storage-meter";
import { PricePreview } from "@/components/products/price-preview";
import { productSchema } from "@/components/products/product-schema";
import { BLANK_PRODUCT } from "@/components/products/to-values";
import { compressImage, fitWithin } from "@/lib/media/compress";
import { checkMedia } from "@/lib/media/store";
import { compareAtFromPercent, discountPercent, money } from "@/lib/money";
import { STORAGE_QUOTA_BYTES } from "@/lib/plans";

afterEach(() => vi.restoreAllMocks());

describe("status tabs", () => {
  function Harness({ spy = vi.fn() }) {
    const [v, setV] = useState<"all" | "live" | "draft">("all");
    return <StatusTabs label="Status" value={v} onChange={(x) => (spy(x), setV(x))} tabs={[{ value: "all", label: "All", count: 3 }, { value: "live", label: "Live", count: 2 }, { value: "draft", label: "Draft", count: 1 }]} />;
  }
  it("is a tablist with counts, one tab stop, and arrow keys", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(screen.getByRole("tablist", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Live/ })).toHaveTextContent("2");
    expect(screen.getAllByRole("tab").filter((t) => t.tabIndex === 0)).toHaveLength(1);
    screen.getByRole("tab", { name: /All/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(spy).toHaveBeenLastCalledWith("live");
    expect(screen.getByRole("tab", { name: /Live/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    expect(spy).toHaveBeenLastCalledWith("draft");
  });
});

describe("discount maths", () => {
  it("works out percent off and the original price for a percent", () => {
    expect(discountPercent(money(80000), money(100000))).toBe(20);
    expect(discountPercent(money(100000), money(100000))).toBe(0);
    expect(discountPercent(money(100000), undefined)).toBe(0);
    expect(compareAtFromPercent(money(80000), 20).amount).toBe(100000);
    expect(discountPercent(money(49900), compareAtFromPercent(money(49900), 30))).toBeGreaterThanOrEqual(29);
  });
  it("keeps the original above the price and the percent within 1 to 90", () => {
    expect(compareAtFromPercent(money(10000), 0).amount).toBeGreaterThan(10000);
    expect(compareAtFromPercent(money(10000), 99).amount).toBeLessThanOrEqual(100000);
  });
});

describe("price preview (inside the discount box)", () => {
  it("shows the price, the crossed-out original and the badge in one place", () => {
    render(<PricePreview price={money(80000)} compareAt={money(100000)} />);
    const box = screen.getByLabelText("How the discount looks");
    expect(box).toHaveTextContent("20% off");
    expect(box.querySelector(".line-through")).not.toBeNull();
    // What buyers see is that same line: no second preview box
    expect(screen.queryByText("What buyers see")).toBeNull();
  });
  it("shows no badge without a real discount", () => {
    render(<PricePreview price={money(80000)} compareAt={money(70000)} />);
    expect(screen.queryByText(/% off/)).toBeNull();
    expect(screen.getByText(/Set an original price/)).toBeInTheDocument();
  });
});

describe("custom tax codes", () => {
  const ok = { ...BLANK_PRODUCT, title: "Planner kit", description: "A planner with enough detail." };
  it("accepts a listed or custom 4 to 8 digit code with its rate", () => {
    expect(productSchema.safeParse({ ...ok, taxCode: "998433", taxRate: 18 }).success).toBe(true);
    expect(productSchema.safeParse({ ...ok, taxCode: "85234910", taxRate: 12.5 }).success).toBe(true);
  });
  it("rejects short or non-numeric codes and rates outside 0 to 40", () => {
    expect(productSchema.safeParse({ ...ok, taxCode: "998" }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, taxCode: "99A433" }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, taxCode: "998433", taxRate: 41 }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, taxCode: "998433", taxRate: -1 }).success).toBe(false);
  });
});

describe("image compression", () => {
  it("only shrinks to fit, never enlarges", () => {
    expect(fitWithin(5000, 2500)).toEqual({ width: 2560, height: 1280 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("leaves GIFs, videos and PDFs untouched", async () => {
    for (const type of ["image/gif", "video/mp4", "application/pdf"]) {
      const f = new File(["x".repeat(100)], "a.bin", { type });
      const r = await compressImage(f);
      expect(r.file).toBe(f);
      expect(r.saved).toBe(0);
    }
  });
  it("re-saves a big photo as a smaller WebP and reports the saving", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4000, height: 3000, close: () => undefined })));
    const ctx = { drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb) {
      cb(new Blob(["w".repeat(1000)], { type: "image/webp" }));
    });
    const big = new File(["p".repeat(50_000)], "holiday.JPG", { type: "image/jpeg" });
    const r = await compressImage(big);
    expect(r.file.type).toBe("image/webp");
    expect(r.file.name).toBe("holiday.webp");
    expect(r.saved).toBe(49_000);
    vi.unstubAllGlobals();
  });
  it("keeps the original when WebP isn't smaller", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close: () => undefined })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb) {
      cb(new Blob(["w".repeat(5000)], { type: "image/webp" }));
    });
    const small = new File(["p".repeat(2000)], "a.png", { type: "image/png" });
    expect((await compressImage(small)).file).toBe(small);
    vi.unstubAllGlobals();
  });
  it("lets big photos in (they're shrunk), but not big videos", () => {
    expect(checkMedia({ name: "a.jpg", size: 20 * 1024 * 1024, type: "image/jpeg" }, ["image"])).toBeUndefined();
    expect(checkMedia({ name: "a.mp4", size: 20 * 1024 * 1024, type: "video/mp4" }, ["video"])).toMatch(/10 MB/);
  });
});

describe("storage meter", () => {
  it("is 2 GB and calls 90% nearly full and 100% full", () => {
    expect(STORAGE_QUOTA_BYTES).toBe(2 * 1024 ** 3);
    expect(storageState(0, STORAGE_QUOTA_BYTES)).toBe("ok");
    expect(storageState(STORAGE_QUOTA_BYTES * 0.9, STORAGE_QUOTA_BYTES)).toBe("near");
    expect(storageState(STORAGE_QUOTA_BYTES, STORAGE_QUOTA_BYTES)).toBe("full");
  });
});

describe("HTML upload", () => {
  it("only takes a non-empty .html file within the size cap", () => {
    expect(checkHtmlFile({ name: "page.html", size: 500, type: "text/html" })).toBeUndefined();
    expect(checkHtmlFile({ name: "page.htm", size: 500, type: "" })).toBeUndefined();
    expect(checkHtmlFile({ name: "photo.png", size: 500, type: "image/png" })).toMatch(/isn't an HTML file/);
    expect(checkHtmlFile({ name: "page.html", size: 0, type: "text/html" })).toMatch(/empty/);
    expect(checkHtmlFile({ name: "page.html", size: HTML_MAX_BYTES + 1, type: "text/html" })).toMatch(/up to/);
  });

  it("reads a dropped file, rejects a wrong one, and removes", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<HtmlEditor onChange={onChange} />);
    const zone = screen.getByText(/Drop an HTML file here/).closest("label")!;
    const file = new File(["<h1>Hello</h1>"], "hello.html", { type: "text/html" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "hello.html", source: "<h1>Hello</h1>" })));
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't an HTML file/);
    rerender(<HtmlEditor value={{ name: "hello.html", source: "<h1>Hello</h1>" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Remove hello.html/ }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("clicking opens the file chooser (a real file input that takes .html)", () => {
    render(<HtmlEditor onChange={() => undefined} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toMatch(/\.html/);
  });
});

describe("HTML section", () => {
  it("runs in a sandbox with no same-origin or top-navigation, and with a strict CSP", () => {
    render(<HtmlSection html={{ name: "promo.html", source: "<p>Hi</p>" }} />);
    const frame = screen.getByTitle("promo.html") as HTMLIFrameElement;
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    for (const bad of ["allow-same-origin", "allow-top-navigation", "allow-forms"]) expect(sandbox).not.toContain(bad);
    expect(frame.getAttribute("srcdoc")).toContain("Content-Security-Policy");
    expect(frame.getAttribute("srcdoc")).toContain("default-src 'none'");
    expect(frame.getAttribute("srcdoc")).toContain("<p>Hi</p>");
  });
  it("shows nothing for an empty file", () => {
    const { container } = render(<HtmlSection html={{ name: "x.html", source: "   " }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("reports its height with a message tied to its own id", () => {
    expect(htmlDocument("<p/>", "abc")).toContain('"abc"');
  });
});

describe("clicking a section in the preview", () => {
  it("tells the editor which section was clicked and stops the click doing anything else", () => {
    const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    const href = vi.fn();
    render(
      <>
        <PreviewPicker />
        <div data-pp-section="hero"><button type="button" onClick={href}>Shop</button></div>
        <button type="button">Outside</button>
      </>
    );
    fireEvent.click(screen.getByText("Shop"));
    expect(post).toHaveBeenCalledWith({ type: "pp-select", section: "hero" }, window.location.origin);
    expect(href).not.toHaveBeenCalled();
    post.mockClear();
    fireEvent.click(screen.getByText("Outside"));
    expect(post).not.toHaveBeenCalled();
  });
});
