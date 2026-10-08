import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CryptoForm } from "@/components/payouts/crypto-form";
import { productSchema } from "@/components/products/product-schema";
import { blankProduct } from "@/components/products/to-values";
import { CRYPTO_NETWORKS, holderNameMatches, isWalletAddress, networksFor } from "@/lib/india";

vi.mock("@/hooks/use-current-store", () => ({ useCurrentStore: () => ({ data: { id: "s1", currency: "INR", country: "IN" }, loading: false, error: undefined, reload: () => {} }) }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), getTaxCodes: vi.fn(async () => [{ code: "998433", kind: "SAC", description: "Digital content", rate: 18 }]), getCollections: vi.fn(async () => []), addCryptoWallet: vi.fn(async () => ({ id: "m1", kind: "crypto", label: "USDT on TRC20", last4: "RSTU", holderName: "x", verified: false, primary: true })) }));

describe("bank account in the company's or the director's name", () => {
  const allowed = ["Fixture Traders Pvt Ltd", "Ravi Kumar"];
  it("matches when one name holds all the words of the other, in any case or order", () => {
    expect(holderNameMatches("FIXTURE TRADERS PVT LTD", allowed)).toBe(true);
    expect(holderNameMatches("Fixture Traders", allowed)).toBe(true);
    expect(holderNameMatches("Kumar Ravi S", allowed)).toBe(true);
    expect(holderNameMatches("Ravi", allowed)).toBe(true);
  });
  it("refuses someone else, and an empty name", () => {
    expect(holderNameMatches("Somebody Else", allowed)).toBe(false);
    expect(holderNameMatches("--", allowed)).toBe(false);
    expect(holderNameMatches("Ravi Kumar", [undefined, ""])).toBe(false);
  });
});

describe("crypto wallets", () => {
  const tron = "T" + "A".repeat(33);
  const eth = "0x" + "a1".repeat(20);
  it("knows what each network's address looks like", () => {
    expect(isWalletAddress("TRC20", tron)).toBe(true);
    expect(isWalletAddress("TRC20", eth)).toBe(false);
    for (const n of ["ERC20", "BEP20", "POLYGON"] as const) expect(isWalletAddress(n, eth)).toBe(true);
    expect(isWalletAddress("ERC20", "0x123")).toBe(false);
    expect(isWalletAddress("BITCOIN", "bc1q" + "a".repeat(30))).toBe(true);
  });
  it("offers only the networks an asset can travel on", () => {
    expect(networksFor("BTC")).toEqual(["BITCOIN"]);
    expect(networksFor("USDT")).toContain("TRC20");
    expect(networksFor("ETH")).toEqual(["ERC20"]);
    expect(Object.keys(CRYPTO_NETWORKS)).toHaveLength(6);
  });
  it("only enables Save once the address is right and typed twice", async () => {
    const onSaved = vi.fn();
    render(<CryptoForm onSaved={onSaved} />);
    const save = screen.getByRole("button", { name: "Save wallet" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Wallet address"), "nonsense");
    expect(await screen.findByText(/doesn't look like a TRON/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Wallet address"));
    await userEvent.type(screen.getByLabelText("Wallet address"), tron);
    await userEvent.type(screen.getByLabelText("Type it again"), tron.slice(0, 10));
    expect(await screen.findByText(/don't match/)).toBeInTheDocument();
    expect(save).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("Type it again"));
    await userEvent.type(screen.getByLabelText("Type it again"), tron);
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("digital and physical products", () => {
  const base = { ...blankProduct("digital"), title: "Planner kit", description: "A planner with enough detail." };
  it("a digital product still needs a file to go live", () => {
    expect(productSchema.safeParse({ ...base, status: "published" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, status: "published", files: [{ id: "f", name: "a.pdf", size: 1, mime: "application/pdf" }] }).success).toBe(true);
  });
  it("a physical product needs no file, but needs a collection", () => {
    const physical = { ...blankProduct("physical"), title: "Notebook", description: "A hand-bound notebook for your desk.", taxCode: "482010", taxRate: 12, status: "published" as const };
    const noCollection = productSchema.safeParse(physical);
    expect(noCollection.success).toBe(false);
    expect(JSON.stringify(noCollection.success ? [] : noCollection.error.issues)).toMatch(/collection/i);
    expect(productSchema.safeParse({ ...physical, collectionIds: ["c1"] }).success).toBe(true);
  });
  it("starts a physical product with no tax code (goods use HSN codes) and a digital one with the default SAC", () => {
    expect(blankProduct("physical").taxCode).toBe("");
    expect(blankProduct("digital").taxCode).toBe("998433");
  });
});

describe("crypto form with Bitcoin", () => {
  it("picking BTC moves to the Bitcoin network and accepts a Bitcoin address", async () => {
    const user = userEvent.setup();
    render(<CryptoForm onSaved={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: /get paid in/i }));
    await user.click(screen.getByRole("option", { name: "BTC" }));
    await user.type(screen.getByLabelText("Wallet address"), "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
    expect(screen.queryByText(/doesn't look like/)).toBeNull();
  });
  it("a missing network never throws", () => {
    expect(isWalletAddress("" as never, "x")).toBe(false);
  });
});

describe("first product in three steps", () => {
  it("shows one step at a time and won't move on until the step is fine", async () => {
    const { ProductForm } = await import("@/components/products/product-form");
    const { UnsavedChangesProvider } = await import("@/components/save/unsaved-guard");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const onSubmit = vi.fn(async (_v: unknown) => {});
    render(
      <UnsavedChangesProvider>
        <ProductForm wizard initial={blankProduct("digital", "INR")} onSubmit={onSubmit} submitLabel="Create product" />
      </UnsavedChangesProvider>
    );
    // Step 1: the kind, the name and the description. No price yet.
    expect(screen.getByText("What are you selling?")).toBeInTheDocument();
    expect(screen.queryByLabelText("Price")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByText(/name buyers will understand/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Weekly planner" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "A printable weekly planner with goals." } });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    // Step 2: images and the file
    expect(await screen.findByRole("region", { name: "Files" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    // Step 3: price in the store's currency, then create
    await waitFor(() => expect(screen.getByRole("region", { name: "Pricing" })).toBeInTheDocument());
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    // Both ways to finish are there; a digital product with no file can't go live yet
    expect(screen.getByRole("button", { name: "Create and make it live" })).toBeInTheDocument();
    expect(screen.getByText(/To go live: add the file buyers will download/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create and make it live" }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ status: "draft", title: "Weekly planner" });
  });

  it("a physical product in a collection can be created live in one click", async () => {
    const { ProductForm } = await import("@/components/products/product-form");
    const { UnsavedChangesProvider } = await import("@/components/save/unsaved-guard");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const onSubmit = vi.fn(async (_v: unknown) => {});
    render(
      <UnsavedChangesProvider>
        <ProductForm wizard initial={{ ...blankProduct("physical", "INR"), title: "Dotted notebook", description: "A hardbound dotted notebook, 200 pages.", collectionIds: ["c1"], taxCode: "4820", taxRate: 12 }} onSubmit={onSubmit} />
      </UnsavedChangesProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Next/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Create and make it live" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ status: "published", fulfilment: "physical" });
  });

  it("asks a physical product for its collection on the second step", async () => {
    const { ProductForm } = await import("@/components/products/product-form");
    const { UnsavedChangesProvider } = await import("@/components/save/unsaved-guard");
    const { fireEvent } = await import("@testing-library/react");
    render(
      <UnsavedChangesProvider>
        <ProductForm wizard initial={blankProduct("digital", "INR")} onSubmit={async () => {}} />
      </UnsavedChangesProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Physical product/ }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Dotted notebook" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "A hardbound dotted notebook, 200 pages." } });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByRole("region", { name: "Collection (required)" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Files" })).toBeNull();
    // Without one it stays on this step
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByText(/Put this product in a collection/)).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  });
});

describe("product form: top bar, image tabs and the draft note", () => {
  it("puts Create and Discard at the top, says it is a draft, and switches between image upload and colour", async () => {
    const { ProductForm } = await import("@/components/products/product-form");
    const { UnsavedChangesProvider } = await import("@/components/save/unsaved-guard");
    const { fireEvent } = await import("@testing-library/react");
    render(
      <UnsavedChangesProvider>
        <ProductForm initial={blankProduct("digital", "INR")} onSubmit={async () => {}} submitLabel="Create product" />
      </UnsavedChangesProvider>
    );
    const form = document.querySelector("form")!;
    const create = screen.getByRole("button", { name: "Create product" });
    const discard = screen.getByRole("button", { name: "Discard" });
    // Both come before the first panel
    const firstPanel = screen.getByRole("region", { name: "Details" });
    expect(create.compareDocumentPosition(firstPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(discard.compareDocumentPosition(firstPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(form).toContainElement(create);
    expect(screen.getByText(/Draft: not visible to buyers/)).toBeInTheDocument();
    // A way to make it live is right there
    expect(screen.getByRole("button", { name: "Create and make it live" })).toBeInTheDocument();
    expect(screen.getByText(/Still needed: images or video, file to download, type/)).toBeInTheDocument();
    // Image upload first; Colour shows the colour picker instead
    expect(screen.getByRole("button", { name: "Image upload", pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Colour" }));
    expect(screen.getByRole("radiogroup", { name: "Theme colours" })).toBeInTheDocument();
  });
});
