import { useState } from "react";
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
import { PLAN_COMPARISON } from "@/lib/plans";
import type { TileBackground } from "@/lib/types";

function Harness({ onSave }: { onSave: (v: { name: string }) => Promise<void> }) {
  const [saved, setSaved] = useState({ name: "Inkwell" });
  const [value, setValue] = useState(saved);
  const bar = useDirtyForm({
    value,
    saved,
    onSave: async (v) => {
      await onSave(v);
      setSaved(v);
    },
    onDiscard: () => setValue(saved),
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

const renderHarness = (onSave = vi.fn(async () => {})) => {
  render(
    <UnsavedChangesProvider>
      <Harness onSave={onSave} />
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
});

describe("SaveBar with useDirtyForm", () => {
  it("is hidden on load and appears after an edit", () => {
    const { input } = renderHarness();
    expect(bar()).toBeNull();
    fireEvent.change(input, { target: { value: "Inkwell Studio" } });
    expect(bar()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("hides again when the field is changed back", () => {
    const { input } = renderHarness();
    fireEvent.change(input, { target: { value: "Inkwell Studio" } });
    fireEvent.change(input, { target: { value: "Inkwell" } });
    expect(bar()).toBeNull();
  });

  it("Discard puts the saved value back", () => {
    const { input } = renderHarness();
    fireEvent.change(input, { target: { value: "Something else" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(input).toHaveValue("Inkwell");
    expect(bar()).toBeNull();
  });

  it("hides after a successful save", async () => {
    const { input, onSave } = renderHarness();
    fireEvent.change(input, { target: { value: "Inkwell Studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(bar()).toBeNull());
    expect(onSave).toHaveBeenCalledWith({ name: "Inkwell Studio" });
  });

  it("stays and shows the error when saving fails", async () => {
    const { input } = renderHarness(vi.fn(async () => Promise.reject(new Error("The server didn't answer."))));
    fireEvent.change(input, { target: { value: "Inkwell Studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("The server didn't answer.")).toBeInTheDocument();
    expect(bar()).toBeInTheDocument();
  });

  it("asks before following a link with unsaved changes", async () => {
    const { input } = renderHarness();
    fireEvent.click(screen.getByRole("link", { name: "Products" }));
    expect(screen.queryByText("Leave without saving?")).toBeNull();
    fireEvent.change(input, { target: { value: "Inkwell Studio" } });
    fireEvent.click(screen.getByRole("link", { name: "Products" }));
    expect(await screen.findByText("Leave without saving?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(input).toHaveValue("Inkwell Studio");
  });

  it("warns on refresh or closing the tab", () => {
    const { input } = renderHarness();
    fireEvent.change(input, { target: { value: "Inkwell Studio" } });
    const e = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(e);
    });
    expect(e.defaultPrevented).toBe(true);
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
    render(<PlanComparisonTable current="free" />);
    expect(screen.getAllByRole("row")).toHaveLength(PLAN_COMPARISON.length + 1);
    expect(screen.getByRole("columnheader", { name: "Free (yours)" })).toBeInTheDocument();
  });
});
