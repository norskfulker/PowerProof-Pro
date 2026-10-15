import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SetupChooser } from "./setup-chooser";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: React.ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
}

describe("SetupChooser", () => {
  it("offers AI and manual, with neither picked at first", () => {
    const { host, unmount } = mount(<SetupChooser onChange={() => {}} />);
    const radios = [...host.querySelectorAll('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual([expect.stringContaining("Build with AI"), expect.stringContaining("Set it up myself")]);
    expect(radios.every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
    expect(host.textContent).toContain("switch between the two until your store opens");
    unmount();
  });

  it("switches either way from the compact switch", () => {
    const onChange = vi.fn();
    const { host, unmount } = mount(<SetupChooser compact value="ai" onChange={onChange} />);
    const [ai, manual] = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(ai.getAttribute("aria-checked")).toBe("true");
    act(() => manual.click());
    expect(onChange).toHaveBeenCalledWith("manual");
    unmount();
  });
});
