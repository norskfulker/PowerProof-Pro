"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ProgressRing, StepItem } from "@/components/getting-started/parts";
import { BackgroundPicker } from "@/components/media/background-picker";
import { MediaUploader } from "@/components/media/media-uploader";
import { TileBackgroundView } from "@/components/media/tile-background";
import { usePlan } from "@/components/plan/plan-context";
import { PlanComparisonTable, PlanUsage } from "@/components/plan/plan-usage";
import { CreatorProviders } from "@/components/pp/creator-providers";
import { Segmented } from "@/components/pp/segmented";
import { SaveBar } from "@/components/save/save-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { setPlanTier, type ChecklistStep } from "@/lib/api";
import type { MediaRef, TileBackground } from "@/lib/types";
import { Section, Specimen } from "./_section";

const step = (n: number, title: string, state: ChecklistStep["state"], optional = false): ChecklistStep => ({
  id: "first_product",
  n,
  title,
  why: "Something to sell. Upload a file, paste a link or build a page.",
  optional,
  state,
  href: "/products/new",
  coach: "new-product",
  coachText: "Start here.",
});

/** Dev-only: flips the mock account between Free and Pro so limits can be tried */
function PlanToggle() {
  const plan = usePlan();
  const tier = plan.state?.tier ?? "pro";
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Mock plan"
        value={tier}
        onChange={async (t) => {
          await setPlanTier(t);
          plan.reload();
          toast.success(`Mock account is on ${t === "free" ? "Free" : "Pro"}`);
        }}
        options={[{ value: "free", label: "Free" }, { value: "pro", label: "Pro" }]}
      />
      <p className="text-sm text-muted-foreground">Changes the demo account in this browser. On Free, a second product or store opens the Upgrade dialog.</p>
      <PlanUsage tone="card" className="max-w-xs" />
    </div>
  );
}

function SaveBarDemo() {
  const [saved, setSaved] = useState({ name: "Ananya's Notion Studio" });
  const [value, setValue] = useState(saved);
  const [fail, setFail] = useState(false);
  const bar = useDirtyForm({
    value,
    saved,
    onSave: async (v) => {
      await new Promise((r) => setTimeout(r, 600));
      if (fail) throw new Error("That didn't save. Check your connection and try again.");
      setSaved(v);
    },
    onDiscard: () => setValue(saved),
    savedMessage: "Saved",
  });
  return (
    <div className="flex flex-col gap-3">
      <SaveBar state={bar} bottomOffset="none" className="max-md:static md:ml-auto md:w-fit" />
      <Label htmlFor="sb-demo">Store name</Label>
      <Input id="sb-demo" value={value.name} onChange={(e) => setValue({ name: e.target.value })} />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} className="size-4" /> Make the next save fail
      </label>
    </div>
  );
}

export function Part6Components() {
  const [media, setMedia] = useState<MediaRef>();
  const [bg, setBg] = useState<TileBackground>({ kind: "color", color: "#0F3D33" });
  return (
    <CreatorProviders tracker={false}>
      <Section id="plans" title="Plans" description="Free: 1 store, 1 product. Pro removes the limits. Same fee per sale. The toggle is for trying limits in the demo.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen label="Dev: plan toggle"><PlanToggle /></Specimen>
          <Specimen label="Free vs Pro" className="overflow-x-auto"><PlanComparisonTable /></Specimen>
        </div>
      </Section>
      <Section id="media" title="Media" description="One uploader everywhere. Drop, click or paste. Limits are shown before you pick a file.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen label="MediaUploader">
            <MediaUploader label="Hero background" kinds={["image", "gif", "video"]} aspect="16:9" value={media} onChange={setMedia} aiPurpose="hero_banner" />
          </Specimen>
          <Specimen label="BackgroundPicker">
            <BackgroundPicker
              label="Tile"
              value={bg}
              onChange={setBg}
              preview={(b, text) => (
                <TileBackgroundView bg={b} className="grid aspect-[4/3] place-items-center rounded-media p-4">
                  <span className="font-display text-lg" style={{ color: text }}>Notion kits</span>
                </TileBackgroundView>
              )}
            />
          </Specimen>
        </div>
      </Section>
      <Section id="savebar" title="Save bar" description="Only shows when something changed. Changing it back hides it again.">
        <Specimen label="SaveBar"><SaveBarDemo /></Specimen>
      </Section>
      <Section id="getting-started" title="Getting started" description="Progress ring and checklist steps in each state.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          <Specimen label="ProgressRing">
            <div className="flex items-center gap-4">
              <ProgressRing percent={0} />
              <ProgressRing percent={40} />
              <ProgressRing percent={100} size={56} />
            </div>
          </Specimen>
          <Specimen label="StepItem">
            <ul className="flex flex-col gap-1">
              <StepItem step={step(1, "Verify your email", "done")} />
              <StepItem step={step(5, "Add your first product", "not_started")} isNext onGo={() => {}} onSkip={() => {}} />
              <StepItem step={step(6, "Make it yours", "in_progress")} />
              <StepItem step={step(10, "Connect analytics", "skipped", true)} onUnskip={() => {}} />
            </ul>
          </Specimen>
        </div>
      </Section>
    </CreatorProviders>
  );
}
