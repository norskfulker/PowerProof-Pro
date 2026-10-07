import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorModeToggle, LIGHT_DARK, LIGHT_DARK_AUTO } from "@/components/theme/color-mode-toggle";

function Harness({ start = "light" as "light" | "dark" | "auto", three = false, spy = vi.fn() }) {
  const [v, setV] = useState(start);
  return <ColorModeToggle label="Colour mode" value={v} onChange={(x) => (spy(x), setV(x))} options={three ? LIGHT_DARK_AUTO : (LIGHT_DARK as never)} />;
}

describe("ColorModeToggle", () => {
  it("is a radiogroup with correct aria-checked and a single tab stop", () => {
    render(<Harness three start="dark" />);
    expect(screen.getByRole("radiogroup", { name: "Colour mode" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("radio").filter((r) => r.tabIndex === 0)).toHaveLength(1);
  });

  it("moves and selects with the arrow keys, wrapping at the ends, and Home/End", async () => {
    const spy = vi.fn();
    render(<Harness three spy={spy} />);
    screen.getByRole("radio", { name: "Light" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus();
    expect(spy).toHaveBeenLastCalledWith("dark");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(spy).toHaveBeenLastCalledWith("light");
    await userEvent.keyboard("{ArrowLeft}");
    expect(spy).toHaveBeenLastCalledWith("auto");
    await userEvent.keyboard("{Home}");
    expect(spy).toHaveBeenLastCalledWith("light");
    await userEvent.keyboard("{End}");
    expect(spy).toHaveBeenLastCalledWith("auto");
  });

  it("slides the thumb to the chosen segment", async () => {
    const { container } = render(<Harness three />);
    const thumb = () => container.querySelector<HTMLElement>('[data-slot="color-mode-thumb"]')!;
    expect(thumb().style.transform).toBe("translateX(0%)");
    await userEvent.click(screen.getByRole("radio", { name: "Auto" }));
    expect(thumb().style.transform).toBe("translateX(200%)");
    expect(thumb().className).toMatch(/motion-reduce:transition-none/);
  });

  it("keeps the name of an icon-only segment for screen readers and is 44px tall", () => {
    render(<ColorModeToggle label="Colour mode" value="light" onChange={() => undefined} options={LIGHT_DARK} iconOnly />);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark" }).className).toMatch(/min-h-11/);
  });
});
