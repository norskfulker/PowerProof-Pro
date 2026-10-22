"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RenderContext, VisualPageSummary } from "@/lib/api";
import type { EditorPanel } from "@/lib/pages/editor-store";
import { useEditor } from "./editor-context";

/** Where a store link is edited: a route in the app, another page in this editor, or a section on this page */
export type EditTarget =
  | { kind: "route"; href: string; place: string }
  | { kind: "panel"; panel: EditorPanel; at?: string; place: string }
  | { kind: "page"; id: string; place: string }
  | { kind: "section"; id: string; place: string }
  | { kind: "here"; place: string }
  | { kind: "none"; place: string; why: string };

export function editTarget(href: string, context: RenderContext, pages: VisualPageSummary[], currentPageId: string): EditTarget {
  const base = `/s/${context.store.slug}`;
  if (href.startsWith("#section-")) return { kind: "section", id: href.slice(9), place: "that section on this page" };
  if (/^(https?:|mailto:)/i.test(href)) return { kind: "none", place: "another website", why: "It opens another website, so there's nothing to edit here." };
  if (href === "/lookup") return { kind: "none", place: "Find my order", why: "Buyers use it to find their orders. It's the same for every store." };
  if (!href.startsWith(base)) return { kind: "none", place: "this link", why: "It doesn't lead to a page of your store." };
  const rest = href.slice(base.length).split("?")[0].replace(/\/$/, "");
  const home = pages.find((p) => p.home);
  if (rest === "") return home && home.id !== currentPageId ? { kind: "page", id: home.id, place: "your home page" } : { kind: "here", place: "your home page" };
  if (rest === "/products") return { kind: "route", href: "/catalog/products", place: "your products" };
  if (rest === "/about" || rest === "/faq") return { kind: "panel", panel: "content", at: rest.slice(1), place: rest === "/about" ? "your About page" : "your FAQ" };
  if (rest.startsWith("/policies/")) return { kind: "route", href: `/store/current/pages${rest}`, place: `your ${rest.slice(10)} policy` };
  if (rest === "/contact") return { kind: "route", href: "/store/current/settings", place: "your contact details" };
  if (rest.startsWith("/c/")) {
    const c = context.collections.find((x) => x.slug === rest.slice(3));
    return { kind: "route", href: c ? `/catalog/collections/${c.id}` : "/catalog/collections", place: c ? `the ${c.name} collection` : "your collections" };
  }
  if (rest.startsWith("/p/")) {
    const pg = pages.find((x) => x.slug === rest.slice(3));
    if (pg) return pg.id === currentPageId ? { kind: "here", place: pg.title } : { kind: "page", id: pg.id, place: pg.title };
    return { kind: "panel", panel: "pages", place: "your pages" };
  }
  const product = context.products.find((x) => `/${x.slug}` === rest);
  if (product) return { kind: "route", href: `/catalog/products/${product.id}`, place: product.title };
  return { kind: "none", place: "this link", why: "This page isn't edited in the store editor." };
}

/**
 * Clicking a link in the header or footer in the editor doesn't follow it. It asks: here's where
 * it goes, do you want to edit that? The draft is saved before leaving.
 */
export function LinkPrompt({ context, pages, pageId, onLeave }: { context: RenderContext; pages: VisualPageSummary[]; pageId: string; onLeave: () => Promise<void> }) {
  const router = useRouter();
  const prompt = useEditor((s) => s.linkPrompt);
  const { setLinkPrompt, select, openPanel } = useEditor((s) => s);
  const target = prompt ? editTarget(prompt.href, context, pages, pageId) : undefined;
  const close = () => setLinkPrompt(undefined);

  async function go() {
    if (!target) return;
    close();
    if (target.kind === "section") return select(target.id);
    if (target.kind === "here") return select(undefined);
    if (target.kind === "panel") return openPanel(target.panel, target.at);
    await onLeave();
    router.push(target.kind === "page" ? `/store/current/design/pages/${target.id}/edit` : target.kind === "route" ? target.href : "");
  }

  const action = !target || target.kind === "none" ? undefined : target.kind === "section" ? "Select that section" : target.kind === "here" ? "Keep editing it here" : `Edit ${target.place}`;
  return (
    <Dialog open={!!prompt} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>“{prompt?.label}” goes to {target?.place}</DialogTitle>
          <DialogDescription>
            {target?.kind === "none"
              ? target.why
              : target?.kind === "here"
                ? "That's the page you're editing now."
                : target?.kind === "section"
                  ? "It jumps to a section on this page."
                  : target?.kind === "panel"
                    ? "It's edited right here, in a panel beside the page."
                    : target?.kind === "page"
                    ? "That page opens in the store editor. Your changes here are saved first."
                    : "It's edited in another part of PowerProof. Your changes here are saved first."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>Stay here</Button>
          {action && (
            <Button type="button" onClick={go}>
              {action} {target?.kind === "route" ? <ExternalLink aria-hidden /> : <ArrowRight aria-hidden />}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
