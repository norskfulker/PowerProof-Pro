"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/pp/segmented";
import type { AgentManifest, SetupField } from "@/lib/agents/define";

/** The owner's settings for an agent, drawn from its manifest's setup fields */
export function SettingsFields({ manifest, value, onChange }: { manifest: AgentManifest; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-6">
      {manifest.setup.map((f) => (
        <Field key={f.key} field={f} value={value[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </div>
  );
}

function Hint({ text }: { text?: string }) {
  return text ? <p className="text-sm text-muted-foreground">{text}</p> : null;
}

function Field({ field: f, value, onChange }: { field: SetupField; value: unknown; onChange: (v: unknown) => void }) {
  const id = `setup-${f.key}`;
  switch (f.type) {
    case "select":
      return (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{f.label}</span>
          <Segmented label={f.label} value={String(value ?? f.default)} onChange={onChange} options={f.options} />
          <Hint text={f.hint} />
        </div>
      );
    case "multiselect": {
      const picked = Array.isArray(value) ? (value as string[]) : f.default;
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">{f.label}</legend>
          {f.options.map((o) => (
            <label key={o.value} className="flex min-h-11 items-center gap-3 rounded-control border bg-surface px-3 has-disabled:opacity-60">
              <Checkbox checked={picked.includes(o.value)} disabled={!!o.disabled} onCheckedChange={(c) => onChange(c ? [...picked, o.value] : picked.filter((x) => x !== o.value))} />
              <span className="flex-1">{o.label}</span>
              {o.disabled && <span className="text-xs text-muted-foreground">{o.disabled}</span>}
            </label>
          ))}
          <Hint text={f.hint} />
        </fieldset>
      );
    }
    case "number":
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Input id={id} type="number" inputMode="numeric" min={f.min} max={f.max} className="max-w-40" value={String(value ?? f.default)} onChange={(e) => onChange(e.target.value === "" ? f.default : Number(e.target.value))} />
          <Hint text={f.hint} />
        </div>
      );
    case "time_range": {
      const [from, to] = String(value ?? f.default).split("-");
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{f.label}</span>
          <div className="flex items-center gap-2">
            <Input aria-label={`${f.label}: from`} type="time" className="max-w-36" value={from} onChange={(e) => onChange(`${e.target.value}-${to}`)} />
            <span className="text-muted-foreground">to</span>
            <Input aria-label={`${f.label}: to`} type="time" className="max-w-36" value={to} onChange={(e) => onChange(`${from}-${e.target.value}`)} />
          </div>
          <Hint text={f.hint} />
        </div>
      );
    }
    case "day_list":
      return <DayList field={f} value={Array.isArray(value) ? (value as number[]) : f.default} onChange={onChange} />;
    case "text":
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Input id={id} maxLength={f.maxLength} value={String(value ?? f.default)} onChange={(e) => onChange(e.target.value)} />
          <Hint text={f.hint} />
        </div>
      );
  }
}

function DayList({ field: f, value, onChange }: { field: Extract<SetupField, { type: "day_list" }>; value: number[]; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`setup-${f.key}`}>{f.label}</Label>
      <Input
        id={`setup-${f.key}`}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const days = e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
          if (days.length) onChange([...new Set(days)].sort((a, b) => a - b).slice(0, 4));
        }}
      />
      <p className="text-sm text-muted-foreground">
        {value.map((d, i) => `Reminder ${i + 1}: ${d} day${d === 1 ? "" : "s"} late`).join(" · ")}
      </p>
      <Hint text={f.hint} />
    </div>
  );
}
