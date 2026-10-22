import { describe, expect, it } from "vitest";
import { PALETTES } from "../palettes";
import { aiStoreDraftSchema, aiStoreRequestSchema, paletteByName } from "./ai-store";

const base = {
  names: ["Monsoon Candles"],
  tagline: "Small-batch soy candles",
  palette: "Monsoon",
  sells: "physical",
  about: { story: "I pour every candle by hand.", location: "Pune" },
  faq: [{ q: "How long do they burn?", a: "Around 40 hours." }],
  collections: ["Spice"],
  products: [{ title: "Cardamom", description: "Warm and sweet.", kind: "other", collection: "Spice", suggestedPrice: 49900 }],
  notes: [],
};

describe("AI store draft", () => {
  it("keeps a suggested price as a suggestion, never as the price", () => {
    const d = aiStoreDraftSchema.parse(base);
    expect(d.products[0].price).toBeUndefined();
    expect(d.products[0].suggestedPrice).toBe(49900);
  });

  it("falls back to the first palette and digital when AI answers something unknown", () => {
    const d = aiStoreDraftSchema.parse({ ...base, palette: "Neon", sells: "both", products: [{ ...base.products[0], kind: "candle" }] });
    expect(d.palette).toBe(PALETTES[0].name);
    expect(d.sells).toBe("digital");
    expect(d.products[0].kind).toBe("other");
  });

  it("trims long text to the limits the store uses", () => {
    const d = aiStoreDraftSchema.parse({ ...base, tagline: "x".repeat(200) });
    expect(d.tagline).toHaveLength(140);
  });

  it("needs at least one name", () => {
    expect(aiStoreDraftSchema.safeParse({ ...base, names: [] }).success).toBe(false);
  });

  it("finds palettes by name", () => {
    expect(paletteByName("Haldi").bg).toBe("#B7791F");
    expect(paletteByName("nope")).toBe(PALETTES[0]);
  });
});

describe("AI store request", () => {
  it("asks for a real description", () => {
    expect(aiStoreRequestSchema.safeParse({ description: "shop", country: "IN" }).success).toBe(false);
    expect(aiStoreRequestSchema.parse({ description: "Notion templates for students", country: "IN" })).toMatchObject({ link: "", rights: false, language: "English" });
  });
});
