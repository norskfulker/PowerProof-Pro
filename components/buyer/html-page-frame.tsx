"use client";

import { useEffect, useRef, useState } from "react";

const WIRE = `<script>
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-pp-buy]');
  if (!b) return;
  e.preventDefault();
  parent.postMessage({ type: 'pp-buy', productId: b.getAttribute('data-pp-buy') }, '*');
});
document.querySelectorAll('[data-pp-buy]').forEach(function (b) {
  b.style.cursor = 'pointer';
  if (!b.getAttribute('style')) b.setAttribute('style','background:#0F3D33;color:#F5F6F4;border:0;border-radius:10px;padding:12px 20px;font:600 16px system-ui;min-height:44px');
});
function size(){ parent.postMessage({ type: 'pp-height', h: document.documentElement.scrollHeight }, '*'); }
window.addEventListener('load', size); new ResizeObserver(size).observe(document.body);
</script>`;

/** A creator's pasted HTML, sandboxed, with buy buttons wired to real checkout. */
export function HtmlPageFrame({ html, title, onBuy }: { html: string; title: string; onBuy: (productId: string) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      if (e.data?.type === "pp-buy") onBuy(e.data.productId);
      if (e.data?.type === "pp-height") setHeight(Math.max(300, Math.min(6000, e.data.h)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onBuy]);

  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${html.replace(/<script[\s\S]*?<\/script>/gi, "")}${WIRE}</body></html>`;
  return <iframe ref={ref} title={title} sandbox="allow-scripts" srcDoc={doc} style={{ height }} className="w-full rounded-card border bg-white" />;
}
