"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/pp/coming-soon";
import { useApi } from "@/hooks/use-api";
import { connectionOp, currentStoreId, googleSettings } from "@/lib/api/agents";

/**
 * Connect a Google Sheet with Google's own Picker and the drive.file scope: the owner chooses one
 * sheet and the app can read only that file. Google's code client gives a one-time code; the server
 * swaps it for a refresh token (kept sealed) and hands back a short-lived token for the Picker.
 */

interface GoogleWindow {
  google?: {
    accounts: { oauth2: { initCodeClient(o: { client_id: string; scope: string; ux_mode: "popup"; callback(r: { code?: string; error?: string }): void }): { requestCode(): void } } };
    picker: {
      PickerBuilder: new () => PickerBuilder;
      ViewId: { SPREADSHEETS: string };
      Action: { PICKED: string; CANCEL: string };
    };
  };
  gapi?: { load(name: string, cb: () => void): void };
}
interface PickerBuilder {
  addView(v: string): PickerBuilder;
  setOAuthToken(t: string): PickerBuilder;
  setDeveloperKey(k: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setCallback(cb: (d: { action: string; docs?: { id: string; name: string }[] }) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google didn't load. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

export function GoogleSheetButton({ instanceId, connectorKey = "sheet", connectionId, onDone, label = "Connect a Google Sheet" }: { instanceId?: string; connectorKey?: string; connectionId?: string; onDone: (summary: unknown) => void; label?: string }) {
  const { data: cfg, loading } = useApi(googleSettings, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (loading) return <Button variant="secondary" size="lg" disabled>{label}</Button>;
  if (!cfg) return <ComingSoon compact title="Google Sheets" body="Connecting a sheet opens once Google access is set up on this site. Upload a CSV or Excel file for now." />;

  async function pick(token: string, connId: string) {
    const w = window as unknown as GoogleWindow;
    await loadScript("https://apis.google.com/js/api.js");
    await new Promise<void>((r) => w.gapi!.load("picker", r));
    const g = w.google!;
    const b = new g.picker.PickerBuilder().addView(g.picker.ViewId.SPREADSHEETS).setOAuthToken(token).setCallback(async (d) => {
      if (d.action === g.picker.Action.CANCEL) return setBusy(false);
      if (d.action !== g.picker.Action.PICKED || !d.docs?.[0]) return;
      try {
        const r = await connectionOp<{ summary: unknown }>({ op: "google_pick", connectionId: connId, fileId: d.docs[0].id, name: d.docs[0].name, instanceId, connectorKey });
        onDone(r.summary);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The sheet couldn't be read.");
      } finally {
        setBusy(false);
      }
    });
    if (cfg!.apiKey) b.setDeveloperKey(cfg!.apiKey);
    if (cfg!.appId) b.setAppId(cfg!.appId);
    b.build().setVisible(true);
  }

  async function start() {
    setBusy(true);
    setError(undefined);
    try {
      if (connectionId) {
        const { accessToken } = await connectionOp<{ accessToken: string }>({ op: "google_token", connectionId });
        return await pick(accessToken, connectionId);
      }
      await loadScript("https://accounts.google.com/gsi/client");
      const w = window as unknown as GoogleWindow;
      const storeId = await currentStoreId();
      w.google!.accounts.oauth2
        .initCodeClient({
          client_id: cfg!.clientId,
          scope: "https://www.googleapis.com/auth/drive.file",
          ux_mode: "popup",
          callback: async (r) => {
            if (!r.code) {
              setBusy(false);
              if (r.error && r.error !== "access_denied") setError("Google didn't connect. Try again.");
              return;
            }
            try {
              const c = await connectionOp<{ connectionId: string; accessToken: string }>({ op: "google_start", storeId, code: r.code });
              await pick(c.accessToken, c.connectionId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Google didn't connect. Try again.");
              setBusy(false);
            }
          },
        })
        .requestCode();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google didn't connect. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="lg" onClick={start} disabled={busy}>
        <FileSpreadsheet aria-hidden /> {busy ? "Waiting for Google…" : label}
      </Button>
      <p className="text-xs text-muted-foreground">You pick one sheet. PowerProof can read only that file, and checks it once a day.</p>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
