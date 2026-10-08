"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LeadInput } from "@/lib/api";
import { bookableDays, dayLabel, slotsFor, type BookingConfig } from "@/lib/booking";
import type { BlockProps } from "@/lib/pages/schema";
import { cn } from "@/lib/utils";

/**
 * The two lead-gathering blocks. In the editor they look and lay out exactly as they will but
 * nothing is sent; on the live page they submit to the store's leads.
 */
export interface LeadEnv {
  editing: boolean;
  onLead?: (input: LeadInput) => Promise<void>;
  loadBooked?: (from: Date, to: Date) => Promise<{ at: Date; minutes: number }[]>;
}

const INPUT_TYPE = { text: "text", email: "email", phone: "tel", textarea: "text" } as const;
const AUTOCOMPLETE = { text: "name", email: "email", phone: "tel", textarea: "off" } as const;

/** Where the person goes after submitting: only our own pages or https, never anything else */
function go(href: string) {
  if (/^(\/(?!\/)|https:\/\/)/.test(href)) window.location.assign(href);
}

const card = "rounded-card border bg-surface p-5 text-foreground md:p-6";

export function LeadFormBlock({ id, props, env }: { id: string; props: BlockProps<"lead_form">; env: LeadEnv }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (env.editing) return;
    for (const f of props.fields) {
      const v = (values[f.id] ?? "").trim();
      if (f.required && !v) return setError(`${f.label} is needed.`);
      if (f.type === "email" && v && !/^\S+@\S+\.\S+$/.test(v)) return setError("That email looks off. Check for typos.");
    }
    const email = props.fields.find((f) => f.type === "email");
    const phone = props.fields.find((f) => f.type === "phone");
    const name = props.fields.find((f) => f.type === "text");
    const rest = Object.fromEntries(props.fields.filter((f) => f !== email && f !== phone && f !== name).map((f) => [f.label, (values[f.id] ?? "").trim()]).filter(([, v]) => v));
    setState("pending");
    setError(undefined);
    try {
      await env.onLead?.({ kind: "lead", name: name ? values[name.id] : undefined, email: email ? values[email.id] : undefined, phone: phone ? values[phone.id] : undefined, data: rest });
      setState("done");
      if (props.redirectHref) go(props.redirectHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
      setState("idle");
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className={card}>
      <h2 id={`${id}-h`} className="text-2xl">{props.heading}</h2>
      {props.body && <p className="mt-1 text-muted-foreground">{props.body}</p>}
      {state === "done" ? (
        <p role="status" className="mt-4 flex items-start gap-2 font-semibold"><Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> {props.successMessage || "Thanks!"}</p>
      ) : (
        <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-3">
          {props.fields.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-${f.id}`} className="text-sm font-medium">{f.label}{!f.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</label>
              {f.type === "textarea" ? (
                <Textarea id={`${id}-${f.id}`} rows={3} maxLength={1000} value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />
              ) : (
                <Input id={`${id}-${f.id}`} type={INPUT_TYPE[f.type]} autoComplete={AUTOCOMPLETE[f.type]} maxLength={f.type === "email" ? 254 : 200} value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />
              )}
            </div>
          ))}
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" disabled={state === "pending"} className="w-full sm:w-fit">
            {state === "pending" && <Loader2 className="animate-spin" aria-hidden />} {props.buttonLabel}
          </Button>
          {env.editing && <p className="text-xs text-muted-foreground">Preview: nothing is sent from the editor.</p>}
        </form>
      )}
    </section>
  );
}

export function BookingBlock({ id, props, env }: { id: string; props: BlockProps<"booking">; env: LeadEnv }) {
  const cfg: BookingConfig = useMemo(() => ({ durationMin: props.durationMin, days: props.days, startHour: props.startHour, endHour: props.endHour, daysAhead: props.daysAhead, timezone: props.timezone }), [props.durationMin, props.days, props.startHour, props.endHour, props.daysAhead, props.timezone]);
  // "Now" is read once when the block opens (and again after a booking), not on every render
  const [now, setNow] = useState(() => new Date());
  const days = useMemo(() => bookableDays(cfg, now), [cfg, now]);
  const [day, setDay] = useState<string>();
  const [taken, setTaken] = useState<{ at: Date; minutes: number }[]>([]);
  const [loadError, setLoadError] = useState<string>();
  const [slot, setSlot] = useState<Date>();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string>();
  const chosenDay = day && days.some((d) => d.key === day) ? day : days[0]?.key;

  // Times already booked, for the whole window at once
  const horizon = days.at(-1)?.date;
  const { loadBooked } = env;
  useEffect(() => {
    if (!loadBooked || !horizon) return;
    let alive = true;
    loadBooked(new Date(now.getTime() - 86_400_000), new Date(horizon.getTime() + 3 * 86_400_000))
      .then((t) => alive && (setTaken(t), setLoadError(undefined)))
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : "We couldn't load the free times."));
    return () => {
      alive = false;
    };
  }, [loadBooked, horizon, now]);

  const slots = useMemo(() => (chosenDay ? slotsFor(chosenDay, cfg, taken, now) : []), [chosenDay, cfg, taken, now]);
  const zone = props.timezone.replace("_", " ");

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (env.editing || !slot) return;
    if (!form.name.trim()) return setError("Add your name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError("That email looks off. Check for typos.");
    setState("pending");
    setError(undefined);
    try {
      await env.onLead?.({ kind: "booking", name: form.name, email: form.email, phone: form.phone, slotAt: slot.toISOString(), minutes: props.durationMin, data: { "Time zone": zone } });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
      setState("idle");
      // Someone may have just taken it: show the latest
      setSlot(undefined);
      setNow(new Date());
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className={card}>
      <h2 id={`${id}-h`} className="flex items-center gap-2 text-2xl"><CalendarCheck className="size-6 text-primary" aria-hidden /> {props.heading}</h2>
      {props.body && <p className="mt-1 text-muted-foreground">{props.body}</p>}
      <p className="mt-1 text-sm text-muted-foreground">{props.durationMin} minutes · times are in {zone}</p>

      {state === "done" && slot ? (
        <p role="status" className="mt-4 flex items-start gap-2 font-semibold">
          <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <span>{props.successMessage} <span className="block font-normal text-muted-foreground">{dayLabel(days.find((d) => d.key === chosenDay)?.date ?? slot)} at {slotLabel(slot, props.timezone)}</span></span>
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div role="group" aria-label="Pick a day" className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={chosenDay === d.key}
                onClick={() => { setDay(d.key); setSlot(undefined); }}
                className={cn("min-h-11 shrink-0 rounded-control border px-3 text-sm font-medium", chosenDay === d.key ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:border-primary")}
              >
                {dayLabel(d.date)}
              </button>
            ))}
          </div>
          {loadError && <p role="alert" className="text-sm font-medium text-danger">{loadError}</p>}
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No free times on this day. Try another.</p>
          ) : (
            <div role="group" aria-label="Pick a time" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.at.toISOString()}
                  type="button"
                  aria-pressed={slot?.getTime() === s.at.getTime()}
                  onClick={() => setSlot(s.at)}
                  className={cn("min-h-11 rounded-control border px-2 text-sm font-medium", slot?.getTime() === s.at.getTime() ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:border-primary")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {slot && (
            <form noValidate onSubmit={book} className="flex flex-col gap-3 border-t pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${id}-n`} className="text-sm font-medium">Your name</label>
                  <Input id={`${id}-n`} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${id}-e`} className="text-sm font-medium">Email</label>
                  <Input id={`${id}-e`} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-p`} className="text-sm font-medium">Phone <span className="font-normal text-muted-foreground">(optional)</span></label>
                <Input id={`${id}-p`} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" disabled={state === "pending"} className="w-full sm:w-fit">
                {state === "pending" && <Loader2 className="animate-spin" aria-hidden />} {props.buttonLabel} · {slotLabel(slot, props.timezone)}
              </Button>
              {env.editing && <p className="text-xs text-muted-foreground">Preview: nothing is booked from the editor.</p>}
            </form>
          )}
          {!slot && error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}

const slotLabel = (at: Date, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at).toLowerCase();
