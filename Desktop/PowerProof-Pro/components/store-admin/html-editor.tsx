"use client";

import { useId, useRef, useState } from "react";
import { FileCode, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/money";
import type { HtmlSectionContent } from "@/lib/types";
import { cn } from "@/lib/utils";

export const HTML_MAX_BYTES = 300 * 1024;

/** Plain-words problem with a file, or undefined when it can be used as an HTML section. */
export function checkHtmlFile(file: { name: string; size: number; type: string }): string | undefined {
  if (!/\.html?$/i.test(file.name) && file.type !== "text/html") return `${file.name} isn't an HTML file. Choose a .html file.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > HTML_MAX_BYTES) return `${file.name} is ${formatBytes(file.size)}. HTML files can be up to ${formatBytes(HTML_MAX_BYTES)}.`;
  return undefined;
}

/**
 * Upload an HTML file by clicking, or by dragging it in. It's read in the browser and saved with
 * the design (no upload to storage), then shown in a sandboxed frame on the store home.
 */
export function HtmlEditor({ value, onChange }: { value?: HtmlSectionContent; onChange: (v: HtmlSectionContent | undefined) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string>();

  async function take(file?: File | null) {
    if (!file) return;
    setError(undefined);
    const problem = checkHtmlFile(file);
    if (problem) return setError(problem);
    try {
      const source = await file.text();
      if (!source.trim()) return setError(`${file.name} has nothing in it.`);
      onChange({ name: file.name, source, height: value?.height });
    } catch {
      setError(`We couldn't read ${file.name}. Try again.`);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Upload an HTML file and it becomes a section on your store home. It runs in a safe frame: it can&apos;t reach your store, and forms and links out are blocked.</p>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed bg-surface-sunken p-6 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
          drag ? "border-primary bg-primary-soft" : "border-border-strong hover:border-primary"
        )}
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">{value ? "Drop a new file to replace it, or click to choose" : "Drop an HTML file here, or click to choose"}</span>
        <span className="text-xs text-muted-foreground">.html up to {formatBytes(HTML_MAX_BYTES)}</span>
        <input id={id} ref={input} type="file" accept=".html,.htm,text/html" className="sr-only" onChange={(e) => void take(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      {value && (
        <div className="flex items-center gap-3 rounded-control border bg-surface p-3">
          <FileCode className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{value.name}</span>
            <span className="block text-xs text-muted-foreground">{formatBytes(new Blob([value.source]).size)}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)} aria-label={`Remove ${value.name}`}>
            <Trash2 aria-hidden /> Remove
          </Button>
        </div>
      )}
    </div>
  );
}
