import { useEffect, useState } from "react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProgressRing, StepItem } from "@/components/getting-started/parts";
import { BackgroundPicker } from "@/components/media/background-picker";
import { FocalPointPicker } from "@/components/media/focal-point-picker";
import { PlanComparisonTable } from "@/components/plan/plan-usage";
import { SaveBar } from "@/components/save/save-bar";
import { UnsavedChangesProvider } from "@/components/save/unsaved-guard";
import { sameValues, useDirtyForm } from "@/hooks/use-dirty-form";
import type { ChecklistStep } from "@/lib/api";
import { planComparison } from "@/lib/plans";
import { TEST_PLAN_LIMITS } from "@/tests/fixtures";
import type { SectionSetting, TileBackground } from "@/lib/types";

const PLAN_COMPARISON = planComparison(TEST_PLAN_LIMITS);

function Harness({ onSave, autosave = false }: { onSave: (v: { name: string }) => Promise<void>; autosave?: boolean }) {
  const [saved, setSaved] = useState({ name: "Fixture name" });
  const [value, setValue] = useState(saved);
  const bar = useDirtyForm({
    value,
    saved,
    onSave: async (v) => {
      await onSave(v);
      setSaved(v);
    },
    onDiscard: () => setValue(saved),
    autosave,
  });
  return (
    <>
      <label htmlFor="n">Store name</label>
      <input id="n" value={value.name} onChange={(e) => setValue({ name: e.target.value })} />
      <SaveBar state={bar} />
      <Link href="/products">Products</Link>
    </>
  );
}

const renderHarness = (onSave = vi.fn(async () => {}), autosave = false) => {
  render(
    <UnsavedChangesProvider>
      <Harness onSave={onSave} autosave={autosave} />
    </UnsavedChangesProvider>
  );
  return { input: screen.getByLabelText("Store name"), onSave };
};
const bar = () => screen.queryByRole("region", { name: "Unsaved changes" });

describe("sameValues", () => {
  it("compares plain data deeply and ignores undefined keys", () => {
    expect(sameValues({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameValues({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValues({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
  it("treats empty values and a number and its text as the same, but not a real change", () => {
    expect(sameValues({ a: "", b: null, c: undefined }, {})).toBe(true);
    expect(sameValues({ days: 7 }, { days: "7" })).toBe(true);
    expect(sameValues({ a: "x" }, { a: "" })).toBe(false);
    expect(sameValues({ a: 0 }, { a: "" })).toBe(false);
    expect(sameValues([1, ""], [1, null])).toBe(true);
  });
});

describe("SaveBar with useDirtyForm", () => {
  it("is hidden on load and appears after an edit", () => {
    const { input } = renderHarness();
    expect(bar()).toBeNull();
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    expect(bar()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("hides again when the field is changed back", () => {
    const { input } = renderHarness();
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    fireEvent.change(input, { target: { value: "Fixture name" } });
    expect(bar()).toBeNull();
  });

  it("Discard puts the saved value back", () => {
    const { input } = renderHarness();
    fireEvent.change(input, { target: { value: "Something else" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(input).toHaveValue("Fixture name");
    expect(bar()).toBeNull();
  });

  it("hides after a successful save", async () => {
    const { input, onSave } = renderHarness();
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(bar()).toBeNull());
    expect(onSave).toHaveBeenCalledWith({ name: "Fixture name edited" });
  });

  it("stays and shows the error when saving fails", async () => {
    const { input } = renderHarness(vi.fn(async () => Promise.reject(new Error("The server didn't answer."))));
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("The server didn't answer.")).toBeInTheDocument();
    expect(bar()).toBeInTheDocument();
  });

  it("asks before following a link with unsaved changes", async () => {
    const { input } = renderHarness();
    fireEvent.click(screen.getByRole("link", { name: "Products" }));
    expect(screen.queryByText("Leave without saving?")).toBeNull();
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    fireEvent.click(screen.getByRole("link", { name: "Products" }));
    expect(await screen.findByText("Leave without saving?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(input).toHaveValue("Fixture name edited");
  });

  it("doesn't ask when the form only tidied itself and the person did nothing", async () => {
    function Tidy() {
      const [saved] = useState({ name: "Fixture name" });
      const [value, setValue] = useState(saved);
      // A form that rewrites its own value as it loads (a default, a formatted colour): not an edit
      useEffect(() => {
        const t = setTimeout(() => setValue({ name: "Fixture name (tidied)" }), 0);
        return () => clearTimeout(t);
      }, []);
      const bar = useDirtyForm({ value, saved, onSave: async () => undefined, onDiscard: () => setValue(saved), autosave: false });
      return (
        <>
          <SaveBar state={bar} />
          <Link href="/products">Products</Link>
        </>
      );
    }
    render(
      <UnsavedChangesProvider>
        <Tidy />
      </UnsavedChangesProvider>
    );
    // Wait for the tidy-up to make the form look different from what was saved
    await screen.findByText("Save changes");
    fireEvent.click(screen.getByRole("link", { name: "Products" }));
    expect(screen.queryByText("Leave without saving?")).toBeNull();
    const e = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(e);
    });
    expect(e.defaultPrevented).toBe(false);
  });

  it("warns on refresh or closing the tab", () => {
    const { input } = renderHarness();
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    const e = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(e);
    });
    expect(e.defaultPrevented).toBe(true);
  });
});

describe("autosave", () => {
  it("saves a moment after the last edit, with no Save or Discard to press", async () => {
    const { input, onSave } = renderHarness(vi.fn(async () => {}), true);
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: "Fixture name edited" }), { timeout: 3000 });
    expect(await screen.findByText("All changes saved")).toBeInTheDocument();
  });

  it("waits for the typing to stop: one save for a burst of edits", async () => {
    const { input, onSave } = renderHarness(vi.fn(async () => {}), true);
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.change(input, { target: { value: "AB" } });
    fireEvent.change(input, { target: { value: "ABC" } });
    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 3000 });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ name: "ABC" });
  });

  it("never asks 'Leave without saving?' while it is waiting to save", () => {
    const { input } = renderHarness(vi.fn(async () => {}), true);
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    fireEvent.click(screen.getByRole("link", { name: "Products" }));
    expect(screen.queryByText("Leave without saving?")).toBeNull();
  });

  it("says what went wrong, offers a retry and doesn't hammer the server", async () => {
    const onSave = vi.fn(async () => Promise.reject(new Error("The server didn't answer.")));
    const { input } = renderHarness(onSave, true);
    fireEvent.change(input, { target: { value: "Fixture name edited" } });
    expect(await screen.findByText("The server didn't answer.", undefined, { timeout: 3000 })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 1600));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });
});

describe("BackgroundPicker", () => {
  function Picker({ initial }: { initial: TileBackground }) {
    const [bg, setBg] = useState(initial);
    return <BackgroundPicker label="Tile" value={bg} onChange={setBg} preview={(b, text) => <p data-testid="preview" style={{ color: text }}>{b.kind}</p>} />;
  }

  it("switches between colour and image with a live preview", () => {
    render(<Picker initial={{ kind: "color", color: "#0F3D33" }} />);
    expect(screen.getByTestId("preview")).toHaveTextContent("color");
    fireEvent.click(screen.getByRole("button", { name: "Image" }));
    expect(screen.getByTestId("preview")).toHaveTextContent("image");
    fireEvent.click(screen.getByRole("button", { name: "Colour" }));
    expect(screen.getByTestId("preview")).toHaveTextContent("color");
  });

  it("warns about low contrast and offers an overlay", () => {
    render(<Picker initial={{ kind: "color", color: "#7A7A7A" }} />);
    expect(screen.getByRole("button", { name: /overlay/i })).toBeInTheDocument();
  });
});

describe("FocalPointPicker", () => {
  it("moves with the arrow keys", () => {
    const onChange = vi.fn();
    render(
      <FocalPointPicker value={{ x: 50, y: 50 }} onChange={onChange}>
        <span />
      </FocalPointPicker>
    );
    const s = screen.getByRole("slider");
    fireEvent.keyDown(s, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[0][0];
    expect(arg.x).toBeGreaterThan(50);
  });
});

describe("Getting started parts", () => {
  const step = (state: ChecklistStep["state"], optional = false): ChecklistStep => ({ id: "analytics", n: 10, title: "Connect analytics", why: "See where buyers come from.", optional, state, href: "/integrations?coach=analytics", coach: "integration-google-analytics", coachText: "Paste your ID." });

  it("ProgressRing announces the percentage", () => {
    render(<ProgressRing percent={40} />);
    expect(screen.getByRole("img", { name: "Setup progress: 40%" })).toBeInTheDocument();
  });

  it("StepItem shows each state in words", () => {
    const { rerender } = render(<ul><StepItem step={step("not_started", true)} onSkip={() => {}} /></ul>);
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
    rerender(<ul><StepItem step={step("done")} /></ul>);
    expect(screen.getByText("Done")).toBeInTheDocument();
    rerender(<ul><StepItem step={step("skipped", true)} onUnskip={() => {}} /></ul>);
    expect(screen.getByText("Skipped")).toBeInTheDocument();
  });
});

describe("PlanComparisonTable", () => {
  it("lists every row and marks the current plan", () => {
    render(<PlanComparisonTable current="free" limits={TEST_PLAN_LIMITS} />);
    expect(screen.getAllByRole("row")).toHaveLength(PLAN_COMPARISON.length + 1);
    expect(screen.getByRole("columnheader", { name: "Free (yours)" })).toBeInTheDocument();
  });
});

describe("section switches agree", () => {
  it("the switch in a section's own settings and the one in the list are the same setting", async () => {
    const { SectionSwitch, SectionToggleList } = await import("@/components/pp/section-toggle-list");
    function Both() {
      const [sections, setSections] = useState<SectionSetting[]>([{ id: "announcement", enabled: false }, { id: "hero", enabled: true }]);
      return (
        <>
          <SectionSwitch id="announcement" sections={sections} onChange={setSections} />
          <SectionToggleList sections={sections} onChange={setSections} />
        </>
      );
    }
    render(<Both />);
    const own = screen.getByRole("switch", { name: "Announcement bar on your store" });
    const list = screen.getByRole("switch", { name: "Show Announcement bar" });
    expect(own).not.toBeChecked();
    expect(list).not.toBeChecked();
    fireEvent.click(own);
    expect(list).toBeChecked();
    fireEvent.click(list);
    expect(own).not.toBeChecked();
  });
});
