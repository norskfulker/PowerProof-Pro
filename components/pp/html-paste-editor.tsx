"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Script injected into the preview: turns data-pp-buy buttons into real buy buttons. */
const WIRE_SCRIPT = `<script>
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-pp-buy]');
  if (!b) return;
  e.preventDefault();
  parent.postMessage({ type: 'pp-buy', productId: b.getAttribute('data-pp-buy') }, '*');
});
document.querySelectorAll('[data-pp-buy]').forEach(function (b) {
  b.style.cursor = 'pointer';
  if (!b.getAttribute('style')) b.setAttribute('style','background:#0F3D33;color:#F5F6F4;border:0;border-radius:10px;padding:12px 20px;font:600 16px system-ui;');
});
</script>`;

export function findBuyButtons(html: string): string[] {
  return [...html.matchAll(/data-pp-buy=["']([^"']+)["']/g)].map((m) => m[1]);
}

export function HtmlPasteEditor({
  value,
  onChange,
  productNames = {},
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  /** productId → title, to label wired buttons */
  productNames?: Record<string, string>;
  className?: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [debounced, setDebounced] = useState(value);
  const gutter = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "pp-buy") {
        const name = productNames[e.data.productId];
        if (name) toast.success(`Buy button works`, { description: `Opens checkout for ${name}.` });
        else toast.error(`No product with ID “${e.data.productId}”`, { description: "Pick a product ID from the list on the right." });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [productNames]);

  const lines = value.split("\n").length;
  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${debounced}${WIRE_SCRIPT}</body></html>`,
    [debounced]
  );
  const buttons = findBuyButtons(value);

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-card border bg-foreground">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="font-mono text-[11px] tracking-[0.08em] text-primary-foreground/70 uppercase">HTML</span>
          <span className="font-mono text-[11px] text-primary-foreground/70">
            {buttons.length} buy button{buttons.length === 1 ? "" : "s"} found
          </span>
        </div>
        <div className="relative flex flex-1 overflow-hidden">
          <div
            ref={gutter}
            aria-hidden
            className="w-11 shrink-0 overflow-hidden py-3 pr-2 text-right font-mono text-xs leading-6 text-primary-foreground/40 select-none"
          >
            {Array.from({ length: lines }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <label htmlFor="html-source" className="sr-only">
            Paste your HTML
          </label>
          <textarea
            id="html-source"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                escaped.current = true;
                return;
              }
              if (e.key === "Tab" && escaped.current) {
                escaped.current = false;
                return;
              }
              escaped.current = false;
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                const el = e.currentTarget;
                const s = el.selectionStart;
                onChange(value.slice(0, s) + "  " + value.slice(el.selectionEnd));
                requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
              }
            }}
            placeholder="<section>Paste your page here…</section>"
            className="flex-1 resize-none bg-transparent py-3 pr-4 font-mono text-[13px] leading-6 whitespace-pre text-primary-foreground caret-accent outline-none placeholder:text-primary-foreground/40 focus-visible:outline-none"
          />
        </div>
        <p className="border-t border-white/10 px-4 py-2 text-xs text-primary-foreground/70">
          Tab indents. Esc then Tab moves focus out. Scripts you paste are stripped on publish.
        </p>
      </div>

      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-card border bg-surface">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
          <span className="eyebrow pl-1">Live preview</span>
          <div className="flex gap-1" role="group" aria-label="Preview size">
            <Button size="icon-sm" variant={device === "desktop" ? "secondary" : "ghost"} aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} aria-label="Desktop preview">
              <Monitor />
            </Button>
            <Button size="icon-sm" variant={device === "mobile" ? "secondary" : "ghost"} aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} aria-label="Phone preview">
              <Smartphone />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 justify-center bg-surface-sunken p-3">
          <iframe
            title="Page preview"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className={cn(
              "h-full min-h-[360px] rounded-media border bg-white transition-[width] duration-200",
              device === "mobile" ? "w-[375px] max-w-full" : "w-full"
            )}
          />
        </div>
      </div>
    </div>
  );
}
