import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrandColorPicker } from "@/components/pp/brand-color-picker";
import { normalizeHex } from "@/lib/color";
import { cleanStoreName, initialsOf, storeNameError, STORE_NAME_MAX } from "@/lib/slug";

describe("store name rules", () => {
  it("allows letters, numbers, spaces and dashes in any script", () => {
    for (const ok of ["Fixture Studio 2", "Fixture-Studio", "आदित्य की दुकान", "Ab"]) expect(storeNameError(ok)).toBeNull();
  });
  it("rejects special characters, empty and too-short names", () => {
    for (const bad of ["Fixture!", "a@b", "Shop & Co", "Shop's", "<b>x</b>", "-lead", "A", "   ", ""]) expect(storeNameError(bad)).not.toBeNull();
  });
  it("is 2 to 74 characters after trimming and collapsing spaces", () => {
    expect(STORE_NAME_MAX).toBe(74);
    expect(storeNameError("a".repeat(74))).toBeNull();
    expect(storeNameError("a".repeat(75))).not.toBeNull();
    expect(cleanStoreName("  Fixture    Studio  ")).toBe("Fixture Studio");
    expect(storeNameError(`  ${"a".repeat(74)}  `)).toBeNull();
  });
  it("derives logo letters from the name", () => {
    expect(initialsOf("Fixture Studio")).toBe("FS");
    expect(initialsOf("")).toBe("PP");
  });
});

describe("normalizeHex", () => {
  it("returns #RRGGBB for every accepted format", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("#abcd")).toBe("#AABBCC");
    expect(normalizeHex("#0f3d33")).toBe("#0F3D33");
    expect(normalizeHex("#0f3d33cc")).toBe("#0F3D33");
    expect(normalizeHex("rgb(15, 61, 51)")).toBe("#0F3D33");
    expect(normalizeHex("rgba(15 61 51 / 0.5)")).toBe("#0F3D33");
  });
  it("rejects everything else", () => {
    for (const bad of ["", "red", "0f3d33", "#12345", "#gggggg", "rgb(300,0,0)", "rgb(1,2)", "hsl(0,0%,0%)"]) expect(normalizeHex(bad)).toBeNull();
  });
});

describe("BrandColorPicker", () => {
  it("picks a preset or any colour, always as #RRGGBB", () => {
    const onChange = vi.fn();
    render(<BrandColorPicker value="#0F3D33" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Monsoon" }));
    expect(onChange).toHaveBeenLastCalledWith("#1D5C7A");
    fireEvent.change(screen.getByLabelText("Pick any colour"), { target: { value: "#aa22cc" } });
    expect(onChange).toHaveBeenLastCalledWith("#AA22CC");
  });
});
