import Link from "next/link";
import { ColorModeToggle, LIGHT_DARK } from "@/components/theme/color-mode-toggle";
import type { SocialLinks, Store } from "@/lib/types";
import { LogoMark } from "./logo";
import { StoreLogo } from "./store-navbar";

export function StoreFooter({
  store,
  socials,
  showPoweredBy,
  pages = [],
  theme,
}: {
  store: Store;
  socials: SocialLinks;
  showPoweredBy: boolean;
  pages?: { title: string; slug: string }[];
  /** Buyer's light/dark switch (Part 7A) */
  theme?: { mode: "light" | "dark"; onChange: (m: "light" | "dark") => void };
}) {
  const base = `/s/${store.slug}`;
  const cols: [string, [string, string][]][] = [
    ["Shop", [["All products", `${base}/products`], ["About", `${base}/about`], ["FAQ", `${base}/faq`], ...pages.slice(0, 4).map((p) => [p.title, `${base}/p/${p.slug}`] as [string, string])]],
    ["Help", [["Contact", `${base}/contact`], ["Find my order", "/lookup"], ["Refund policy", `${base}/policies/refund`]]],
    ["Legal", [["Terms", `${base}/policies/terms`], ["Privacy", `${base}/policies/privacy`]]],
  ];
  const social = Object.entries(socials).filter(([, v]) => v) as [string, string][];
  const names: Record<string, string> = { instagram: "Instagram", youtube: "YouTube", x: "X", website: "Website" };

  return (
    <footer className="mt-20 border-t bg-surface">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-6 [&>*]:min-w-0">
        <div>
          <StoreLogo store={store} />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{store.tagline}</p>
          {social.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4">
              {social.map(([k, v]) => (
                <li key={k}><a href={v} target="_blank" rel="noreferrer" className="inline-flex min-h-11 min-w-11 items-center text-sm font-medium hover:underline">{names[k] ?? k}</a></li>
              ))}
            </ul>
          )}
        </div>
        {cols.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="eyebrow mb-2">{title}</p>
            <ul>
              {links.map(([label, href]) => (
                <li key={href}><Link href={href} className="inline-flex min-h-11 min-w-11 items-center text-sm text-foreground/80 hover:text-foreground hover:underline">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 border-t px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
        <p>© {new Date().getFullYear()} {store.name}. Prices include any GST that applies.</p>
        {theme && (
          <ColorModeToggle label="Store colour mode" value={theme.mode} onChange={theme.onChange} options={LIGHT_DARK} className="sm:order-last" />
        )}
        {showPoweredBy && (
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5"><LogoMark className="size-4" /> Powered by PowerProof</Link>
        )}
      </div>
    </footer>
  );
}
