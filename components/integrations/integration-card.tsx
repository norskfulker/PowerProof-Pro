"use client";

import { useState } from "react";
import { BarChart3, Check, Loader2, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { StatusPill } from "@/components/pp/status-pill";
import { connectIntegration, disconnectIntegration } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Integration } from "@/lib/types";

const META: Record<Integration["id"], { icon: React.ComponentType<{ className?: string }>; where: string; tracks: string[] }> = {
  "google-analytics": {
    icon: BarChart3,
    where: "Google Analytics › Admin › Data streams › your web stream. It starts with G-.",
    tracks: ["Page views on your store and product pages", "Checkout started and purchase events, with value", "UTM sources from your links"],
  },
  "microsoft-clarity": {
    icon: MousePointerClick,
    where: "Clarity › Settings › Overview. The project ID is the short code in the tracking script.",
    tracks: ["Session recordings of buyer pages", "Heatmaps of clicks and scroll", "Rage clicks on checkout"],
  },
};

export function IntegrationCard({ integration, onChange }: { integration: Integration; onChange: (i: Integration) => void }) {
  const meta = META[integration.id];
  const [value, setValue] = useState(integration.value ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const inputId = `int-${integration.id}`;

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return setError(`Paste your ${integration.idLabel.toLowerCase()}.`);
    setPending(true);
    setError(undefined);
    try {
      const out = await connectIntegration(integration.id, value);
      onChange(out);
      toast.success(`${integration.name} connected`, { description: "Data starts flowing on the next visit." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${inputId}-h`} className="flex flex-col rounded-card border bg-surface">
      <div className="flex items-start gap-4 p-5 md:p-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
          <meta.icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${inputId}-h`} className="font-display text-xl">{integration.name}</h2>
            <StatusPill status={integration.connected ? "connected" : "not_connected"} />
          </div>
          <p className="mt-1 text-muted-foreground">{integration.description}</p>
        </div>
      </div>
      <form onSubmit={connect} noValidate className="flex flex-col gap-2 border-t px-5 py-5 md:px-6">
        <Label htmlFor={inputId}>{integration.idLabel}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
            placeholder={integration.idPlaceholder}
            className="font-mono"
            autoCapitalize={integration.id === "google-analytics" ? "characters" : "none"}
            spellCheck={false}
            aria-invalid={!!error || undefined}
            aria-describedby={`${inputId}-help`}
            readOnly={integration.connected}
          />
          {integration.connected ? (
            <Button type="button" variant="secondary" onClick={() => setConfirm(true)}>Disconnect</Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Connect
            </Button>
          )}
        </div>
        <p id={`${inputId}-help`} className={error ? "text-sm font-medium text-danger" : "text-sm text-muted-foreground"} role={error ? "alert" : undefined}>
          {error ?? (integration.connected && integration.connectedAt ? `Connected on ${formatDate(integration.connectedAt)}.` : meta.where)}
        </p>
      </form>
      <div className="mt-auto border-t bg-surface-sunken px-5 py-4 md:px-6">
        <p className="eyebrow mb-2">What gets sent</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {meta.tracks.map((t) => (
            <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{t}</li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disconnect ${integration.name}?`}
        description="We stop adding the tracking code to your pages. Data you already collected stays in your account there."
        confirmLabel="Disconnect"
        onConfirm={async () => {
          const out = await disconnectIntegration(integration.id);
          onChange(out);
          setValue("");
          toast.success(`${integration.name} disconnected`);
        }}
      />
    </section>
  );
}
