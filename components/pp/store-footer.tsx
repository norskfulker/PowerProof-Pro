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
  layout = "columns",
}: {
  store: Store;
  socials: SocialLinks;
  showPoweredBy: boolean;
  pages?: { title: string; slug: string }[];
  /** Buyer's light/dark switch (Part 7A) */
  theme?: { mode: "light" | "dark"; onChange: (m: "light" | "dark") => void };
  /** The site layout's footer: link columns, everything centred, or one quiet line */
  layout?: "columns" | "centered" | "minimal";
}) {
  const base = `/s/${store.slug}`;
  const cols: [string, [string, string][]][] = [
    ["Shop", [["All products", `${base}/products`], ["About", `${base}/about`], ["FAQ", `${base}/faq`], ...pages.slice(0, 4).map((p) => [p.title, `${base}/p/${p.slug}`] as [string, string])]],
    ["Help", [["Contact", `${base}/contact`], ["Find my order", "/lookup"], ["Refund policy", `${base}/policies/refund`]]],
    ["Legal", [["Terms", `${base}/policies/terms`], ["Privacy", `${base}/policies/privacy`]]],
  ];
  const social = Object.entries(socials).filter(([, v]) => v) as [string, string][];
  const names: Record<string, string> = { instagram: "Instagram", youtube: "YouTube", x: "X", website: "Website" };

  const bottom = (
    <>
      <p>© {new Date().getFullYear()} {store.name}. Prices include any GST that applies.</p>
      {theme && <ColorModeToggle label="Store colour mode" value={theme.mode} onChange={theme.onChange} options={LIGHT_DARK} className="sm:order-last" />}
      {showPoweredBy && (
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5"><LogoMark className="size-4" /> Powered by PowerProof</Link>
      )}
    </>
  );
  const socialLinks = social.map(([k, v]) => (
    <li key={k}><a href={v} target="_blank" rel="noreferrer" className="inline-flex min-h-11 min-w-11 items-center text-sm font-medium hover:underline">{names[k] ?? k}</a></li>
  ));

  if (layout === "minimal") {
    // One line: the store, a few links, the small print
    const few: [string, string][] = [["Shop", `${base}/products`], ["About", `${base}/about`], ["Contact", `${base}/contact`], ["Terms", `${base}/policies/terms`], ["Privacy", `${base}/policies/privacy`]];
    return (
      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-6 text-xs text-muted-foreground md:flex-row md:flex-wrap md:items-center md:justify-between md:px-6">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-4">
              {few.map(([label, href]) => <li key={href}><Link href={href} className="inline-flex min-h-11 items-center text-sm text-foreground/80 hover:text-foreground hover:underline">{label}</Link></li>)}
              {socialLinks}
            </ul>
          </nav>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">{bottom}</div>
        </div>
      </footer>
    );
  }

  if (layout === "centered") {
    return (
      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-5 px-4 py-12 text-center md:px-6">
          <StoreLogo store={store} />
          {store.tagline && <p className="max-w-md text-sm text-muted-foreground">{store.tagline}</p>}
          <nav aria-label="Footer">
            <ul className="flex flex-wrap justify-center gap-x-5">
              {cols.flatMap(([, links]) => links).map(([label, href]) => <li key={href}><Link href={href} className="inline-flex min-h-11 items-center text-sm text-foreground/80 hover:text-foreground hover:underline">{label}</Link></li>)}
            </ul>
          </nav>
          {social.length > 0 && <ul className="flex flex-wrap justify-center gap-x-4">{socialLinks}</ul>}
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-2 border-t px-4 py-5 text-center text-xs text-muted-foreground md:px-6">{bottom}</div>
      </footer>
    );
  }

  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-6 [&>*]:min-w-0">
        <div>
          <StoreLogo store={store} />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{store.tagline}</p>
          {social.length > 0 && <ul className="mt-4 flex flex-wrap gap-x-4">{socialLinks}</ul>}
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
        {bottom}
      </div>
    </footer>
  );
}
