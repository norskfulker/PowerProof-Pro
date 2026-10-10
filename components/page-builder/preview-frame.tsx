"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The editor canvas drawn inside an iframe, through a React portal. The page then responds to the
 * frame's width exactly as it would on a phone or tablet (media queries and container queries
 * both), while staying one React tree with the editor: state, events and context carry straight
 * through. The app's stylesheets and font classes are copied in and kept in sync.
 */
const FrameDoc = createContext<Document | null>(null);

/** The document the canvas lives in (the frame's), for measuring and listening to keys */
export const useFrameDocument = () => useContext(FrameDoc);

/** Mirrors the app's stylesheets into the frame: adds new ones, drops removed ones, leaves the rest alone */
function syncHead(from: Document, to: Document, copies: Map<Element, Element>) {
  const now = new Set(from.head.querySelectorAll('style, link[rel="stylesheet"]'));
  for (const [src, copy] of copies) {
    if (!now.has(src)) {
      copy.remove();
      copies.delete(src);
    } else if (src.tagName === "STYLE" && src.textContent !== copy.textContent) copy.textContent = src.textContent;
  }
  for (const src of now) {
    if (copies.has(src)) continue;
    const copy = src.cloneNode(true) as Element;
    to.head.appendChild(copy);
    copies.set(src, copy);
  }
  // next/font puts its font variables on <html>
  to.documentElement.className = from.documentElement.className;
  to.documentElement.lang = from.documentElement.lang;
}

const SRC = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head><body data-pp-frame></body></html>";

export function PreviewFrame({ title, className, style, children }: { title: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: MutationObserver | undefined;
    const setup = () => {
      const doc = frame.contentDocument;
      // Wait for our own document (the frame starts on a blank one that srcDoc replaces)
      if (!doc?.body?.hasAttribute("data-pp-frame") || doc.getElementById("pp-canvas-root")) return;
      const copies = new Map<Element, Element>();
      syncHead(document, doc, copies);
      doc.body.setAttribute("style", "margin:0");
      const root = doc.createElement("div");
      root.id = "pp-canvas-root";
      doc.body.appendChild(root);
      setMount(root);
      // Styles added later (route chunks, hot reload) follow
      observer?.disconnect();
      observer = new MutationObserver(() => syncHead(document, doc, copies));
      observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    };
    setup();
    frame.addEventListener("load", setup);
    return () => {
      frame.removeEventListener("load", setup);
      observer?.disconnect();
    };
  }, []);

  return (
    <>
      <iframe ref={ref} title={title} className={className} style={style} srcDoc={SRC} />
      {mount && createPortal(<FrameDoc.Provider value={mount.ownerDocument}>{children}</FrameDoc.Provider>, mount)}
    </>
  );
}
