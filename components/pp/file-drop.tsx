"use client";

import { useId, useRef, useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/money";
import type { ProductFile } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/** Drag-and-drop file picker. Uploads are simulated with a progress bar. */
export function FileDrop({
  files,
  onChange,
  invalid,
  describedBy,
  multiple = true,
  accept,
  label = "Drop your file here",
}: {
  files: ProductFile[];
  onChange: (files: ProductFile[]) => void;
  invalid?: boolean;
  describedBy?: string;
  multiple?: boolean;
  accept?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string>();

  function take(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list).slice(0, multiple ? 10 : 1);
    const big = picked.find((f) => f.size > MAX_BYTES);
    if (big) {
      setError(`${big.name} is over 2 GB. Zip it smaller or split it into parts.`);
      return;
    }
    setError(undefined);
    const next: ProductFile[] = picked.map((f) => ({
      id: `f_${Math.random().toString(36).slice(2, 9)}`,
      name: f.name,
      size: f.size,
      mime: f.type || "application/octet-stream",
    }));
    // Simulated upload progress
    let pct = 0;
    setUploading({ name: next[0].name, pct });
    const t = setInterval(() => {
      pct += 18 + Math.random() * 20;
      if (pct >= 100) {
        clearInterval(t);
        setUploading(null);
        onChange(multiple ? [...files, ...next] : next);
      } else setUploading({ name: next[0].name, pct });
    }, 160);
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed bg-surface px-6 py-8 text-center transition-colors duration-150",
          over ? "border-primary bg-primary-soft" : "border-border-strong hover:border-foreground/40",
          (invalid || error) && "border-danger"
        )}
      >
        <UploadCloud className="size-7 text-primary" aria-hidden />
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">or tap to choose · PDF, ZIP, video, anything up to 2 GB</span>
        <input
          ref={input}
          id={id}
          type="file"
          multiple={multiple}
          accept={accept}
          className="sr-only"
          aria-describedby={describedBy}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
      {uploading && (
        <div className="rounded-control border bg-surface px-3.5 py-3" aria-live="polite">
          <p className="mb-2 truncate text-sm">Uploading {uploading.name}…</p>
          <Progress value={uploading.pct} aria-label={`Uploading ${uploading.name}`} />
        </div>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-control border bg-surface py-1.5 pr-1.5 pl-3.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
