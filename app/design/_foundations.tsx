import { Section } from "./_section";

const COLORS: { name: string; token: string; hex: string; note?: string }[] = [
  { name: "Porcelain", token: "--background", hex: "#F5F6F4", note: "Page" },
  { name: "Surface", token: "--surface", hex: "#FFFFFF", note: "Cards, inputs" },
  { name: "Ink", token: "--foreground", hex: "#0C1F1B", note: "Text" },
  { name: "Muted ink", token: "--muted-foreground", hex: "#5B6B66", note: "Secondary text" },
  { name: "Border", token: "--border", hex: "#E3E6E1" },
  { name: "Input edge", token: "--input", hex: "#8F9B95", note: "3:1 on white" },
  { name: "Emerald", token: "--primary", hex: "#0F3D33", note: "Actions" },
  { name: "Emerald soft", token: "--primary-soft", hex: "#E3ECE8" },
  { name: "Brass", token: "--accent", hex: "#C9A24F", note: "Emphasis, sparingly" },
  { name: "Brass strong", token: "--accent-strong", hex: "#A9823A", note: "Key numbers" },
  { name: "Brass ink", token: "--accent-ink", hex: "#7A5C20", note: "Small brass text" },
  { name: "Success", token: "--success", hex: "#1F7A4D" },
  { name: "Warning", token: "--warning", hex: "#B7791F" },
  { name: "Danger", token: "--danger", hex: "#B42318" },
  { name: "Info", token: "--info", hex: "#1D5C7A" },
  { name: "Admin sidebar", token: "--sidebar-admin", hex: "#0A2B24" },
];

const TYPE: [string, string, string][] = [
  ["64", "text-5xl font-display", "Sell it today."],
  ["48", "text-4xl font-display", "Sell it today."],
  ["36", "text-3xl font-display", "Sell it today."],
  ["28", "text-2xl font-display", "Sell it today."],
  ["22", "text-xl font-display", "Section heading"],
  ["18", "text-lg font-semibold", "Card title in body font"],
  ["16", "text-base", "Body. Add a product, share a link, get paid. Nothing else to set up."],
  ["14", "text-sm", "Secondary text, table cells, helper copy."],
  ["12", "text-xs", "Fine print and footnotes."],
];

const RADII: [string, string, string][] = [
  ["Control 10px", "rounded-control", "Buttons, inputs, selects, tabs"],
  ["Media 12px", "rounded-media", "Images, thumbnails"],
  ["Card 16px", "rounded-card", "Cards, panels, tables, popovers"],
  ["Dialog 20px", "rounded-dialog", "Dialogs and sheets"],
  ["Pill", "rounded-full", "Status pills only"],
];

export function Foundations() {
  return (
    <>
      <Section id="colors" title="Colour" description="Emerald for actions, brass for emphasis, everything else neutral. One strong element per area.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map((c) => (
            <li key={c.token} className="overflow-hidden rounded-card border bg-surface">
              <div className="h-20 border-b" style={{ background: `var(${c.token})` }} />
              <div className="p-3">
                <p className="font-semibold">{c.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{c.token}</p>
                <p className="font-mono text-xs text-muted-foreground">{c.hex}{c.note ? ` · ${c.note}` : ""}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {["success", "warning", "danger", "info"].map((s) => (
            <div key={s} className={`rounded-card p-4 bg-${s}-soft`}>
              <p className={`font-semibold capitalize ${s === "warning" ? "text-warning-ink" : `text-${s}`}`}>{s} on tint</p>
              <p className="text-sm">10% tint backgrounds for alerts and pills.</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="Type" description="Bricolage Grotesque 800 for headings, Hanken Grotesk for body, IBM Plex Mono for labels, IDs and amounts in tables.">
        <div className="flex flex-col divide-y rounded-card border bg-surface">
          {TYPE.map(([px, cls, sample]) => (
            <div key={px} className="flex items-baseline gap-6 overflow-hidden px-5 py-4">
              <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{px}</span>
              <span className={`${cls} truncate`}>{sample}</span>
            </div>
          ))}
          <div className="flex items-baseline gap-6 px-5 py-4">
            <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">11</span>
            <span className="eyebrow">Eyebrow · IBM Plex Mono uppercase</span>
          </div>
          <div className="flex items-baseline gap-6 px-5 py-4">
            <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">13</span>
            <span className="font-mono text-[13px]">PP-1081 · ₹1,499.00 · INV-0081</span>
          </div>
        </div>
      </Section>

      <Section id="shape" title="Shape, space, depth" description="Sharp, not bubbly. 4px grid. Flat with 1px borders; one soft shadow, only for popovers and dialogs.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {RADII.map(([label, cls, use]) => (
            <div key={label} className="flex flex-col gap-3">
              <div className={`h-24 border-2 border-primary bg-primary-soft ${cls}`} />
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">{use}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border bg-surface p-6">
            <p className="font-semibold">Flat card</p>
            <p className="text-sm text-muted-foreground">1px border, no shadow. Padding 24px.</p>
          </div>
          <div className="rounded-card border bg-surface p-6 shadow-pop">
            <p className="font-semibold">Popover depth</p>
            <p className="text-sm text-muted-foreground">--shadow-pop. Popovers and dialogs only.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-2">
          {[4, 8, 12, 16, 24, 32, 48, 64].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="w-6 rounded-[2px] bg-accent" style={{ height: n }} />
              <span className="font-mono text-[11px] text-muted-foreground">{n}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
