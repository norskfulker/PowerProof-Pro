"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { uploadFont } from "@/lib/api";
import { FONT_ACCEPT, FONT_FAMILY, fontFaceCss } from "@/lib/fonts";
import type { CustomFont } from "@/lib/types";

/** Upload the store's own font, choose where it's used, or go back to the built-in pairings. */
export function CustomFontField({ value, onChange }: { value?: CustomFont; onChange: (f: CustomFont | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string>();

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setBusy(true);
    setPct(0);
    try {
      onChange(await uploadFont(file, { onProgress: setPct }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't upload.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-control border border-dashed p-3">
      <p className="text-sm font-medium">Your own font</p>
      <input ref={input} type="file" accept={FONT_ACCEPT} className="sr-only" aria-label="Font file" onChange={(e) => void pick(e.target.files?.[0])} />
      {value ? (
        <>
          {/* Loaded here too, so the sample below is set in it before it's even saved */}
          <style>{fontFaceCss(value)}</style>
          <p className="text-2xl leading-tight" style={{ fontFamily: `"${FONT_FAMILY}", sans-serif` }}>Aa {value.name}</p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: `"${FONT_FAMILY}", sans-serif` }}>The quick brown fox jumps over the lazy dog 0123456789</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-use">Use it for</Label>
            <Select value={value.use} onValueChange={(use) => onChange({ ...value, use: use as CustomFont["use"] })}>
              <SelectTrigger id="cf-use" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Headings and text</SelectItem>
                <SelectItem value="headings">Headings only</SelectItem>
                <SelectItem value="body">Text only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)} disabled={busy}><Trash2 aria-hidden /> Remove</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Upload a .woff2, .woff, .ttf or .otf file (up to 2 MB). It loads on your store, and replaces the font above where you choose.</p>
          <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} {busy ? `Uploading ${pct}%` : "Upload a font"}
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">Only upload fonts you have the licence to use on the web.</p>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
