import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";
import { PRODUCT_COLUMNS, parseProducts, templateCsv } from "./products-csv";
import { COUNTRIES, countryByCode, currencyFor } from "./countries";
import { canConvert, convert } from "./fx";

describe("csv", () => {
  it("reads quotes, commas, doubled quotes and line breaks inside fields", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nx,"line\nbreak",z\n')).toEqual([["a", "b, c", 'say "hi"'], ["x", "line\nbreak", "z"]]);
  });
  it("ignores a byte-order mark and blank lines", () => {
    expect(parseCsv("﻿a,b\n\n,\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("writes what it reads", () => {
    const rows = [["a", 'b, "c"'], ["x\ny", ""]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("product import format", () => {
  const head = PRODUCT_COLUMNS.map((c) => c.key).join(",");
  const D = "A long enough description here.";
  /** A row by column name, so tests don't depend on column order */
  const row = (o: Record<string, string>) => PRODUCT_COLUMNS.map((c) => (o[c.key] ?? "").includes(",") ? `"${o[c.key]}"` : o[c.key] ?? "").join(",");
  it("the template follows its own format", () => {
    const { rows, fileError } = parseProducts(templateCsv(), "INR");
    expect(fileError).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.values && !r.error)).toBe(true);
    expect(rows[0].values?.kind).toBe("template");
    expect(rows[1].collection).toBe("Notebooks");
  });
  it("imports as drafts, in the store's currency, with digital defaults", () => {
    const { rows } = parseProducts(`${head}\n${row({ title: "My planner", description: "A printable weekly planner with goals.", price: "1,499" })}`, "USD");
    expect(rows[0].values).toMatchObject({ status: "draft", fulfilment: "digital", kind: "other", taxCode: "998433", taxRate: 18, price: { amount: 149900, currency: "USD" } });
  });
  it("explains what is wrong with a row, by line", () => {
    const { rows } = parseProducts(
      [
        head,
        row({ title: "Ab", description: "short", price: "10" }),
        row({ title: "Good title", description: D, type: "physical", price: "500" }),
        row({ title: "Book", description: D, type: "physical", price: "500", hsn_sac: "4901", gst_rate: "5" }),
        row({ title: "Cup", description: D, type: "gift", price: "500" }),
        row({ title: "Tea", description: D, price: "abc" }),
        row({ title: "Tool", description: D, kind: "gadget", price: "5" }),
      ].join("\n"),
      "INR"
    );
    expect(rows.map((r) => r.error)).toEqual([
      expect.stringMatching(/name buyers will understand/),
      expect.stringMatching(/HSN code/),
      expect.stringMatching(/collection/i),
      expect.stringMatching(/digital or physical/),
      expect.stringMatching(/number/),
      expect.stringMatching(/Kind must be/),
    ]);
    expect(rows[0].line).toBe(2);
  });
  it("refuses a repeated SKU and a file without the needed columns", () => {
    const two = parseProducts([head, row({ title: "One product", description: D, price: "100", sku: "SKU-1" }), row({ title: "Two product", description: D, price: "100", sku: "sku-1" })].join("\n"), "INR");
    expect(two.rows[1].error).toMatch(/also on line 2/);
    expect(parseProducts("name,cost\nA,1", "INR").fileError).toMatch(/title, description, price/);
    expect(parseProducts("", "INR").fileError).toMatch(/empty/);
  });
});

describe("country decides the currency", () => {
  it("maps the countries we list to a currency we can price in", () => {
    expect(currencyFor("IN")).toBe("INR");
    expect(currencyFor("US")).toBe("USD");
    expect(currencyFor("DE")).toBe("EUR");
    expect(countryByCode("ZZ").code).toBe("IN");
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
  });
});

describe("showing a price in another currency", () => {
  const rates = { USD: 1, INR: 84 };
  it("converts through the dollar rates", () => {
    expect(convert({ amount: 8400, currency: "INR" }, "USD", rates)).toEqual({ amount: 100, currency: "USD" });
    expect(convert({ amount: 100, currency: "USD" }, "INR", rates)).toEqual({ amount: 8400, currency: "INR" });
  });
  it("leaves the price alone with no rate for either side", () => {
    const m = { amount: 500, currency: "INR" as const };
    expect(convert(m, "EUR", rates)).toBe(m);
    expect(convert(m, "INR", rates)).toBe(m);
    expect(canConvert({}, "INR")).toBe(false);
    expect(canConvert(rates, "INR")).toBe(true);
  });
});
