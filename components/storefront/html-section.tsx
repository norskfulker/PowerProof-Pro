"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { HtmlSectionContent } from "@/lib/types";

/** What the page inside the frame may load: its own inline code and styles, and https pictures and fonts. Nothing else, so it can't phone home. */
const CSP = "default-src 'none'; img-src https: data:; media-src https: data:; font-src https: data:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; form-action 'none'; base-uri 'none'";

/** The HTML a creator uploaded, wrapped so the frame can report its height. */
export function htmlDocument(source: string, id: string): string {
  const report = `<script>(function(){function s(){try{parent.postMessage({type:"pp-html-height",id:${JSON.stringify(id)},h:(function(){var b=document.body,c=getComputedStyle(b);return Math.ceil(b.getBoundingClientRect().height+(parseFloat(c.marginTop)||0)+(parseFloat(c.marginBottom)||0))})()},"*")}catch(e){}}addEventListener("load",s);addEventListener("resize",s);if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement);setTimeout(s,300)})()</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>html,body{margin:0}</style></head><body>${source}${report}</body></html>`;
}

/**
 * A creator's own HTML on the store home. It runs in a sandboxed frame with no access to the
 * store, the visitor's cookies or storage (no same-origin), and can't submit forms or leave the
 * page. The frame grows to fit what's inside.
 */
export function HtmlSection({ html }: { html: HtmlSectionContent }) {
  const id = useId();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(html.height ?? 400);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; id?: string; h?: number };
      if (d?.type === "pp-html-height" && d.id === id && typeof d.h === "number" && d.h > 0) setHeight(Math.min(4000, Math.ceil(d.h)));
    };
    // The window that holds the frame: the editor draws pages inside its own frame
    const win = frame.current?.ownerDocument.defaultView ?? window;
    win.addEventListener("message", onMsg);
    return () => win.removeEventListener("message", onMsg);
  }, [id, html.source]);

  if (!html.source.trim()) return null;
  return (
    <section aria-label={html.name || "Custom section"} className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
      <iframe
        ref={frame}
        title={html.name || "Custom section"}
        sandbox="allow-scripts allow-popups"
        referrerPolicy="no-referrer"
        loading="lazy"
        srcDoc={htmlDocument(html.source, id)}
        style={{ height }}
        className="block w-full rounded-card border-0 bg-transparent"
      />
    </section>
  );
}
