import Link from "next/link";
import { Logo } from "@/components/pp/logo";
import { CreatorLinks } from "./start-link";

const LINK = "inline-flex min-h-11 min-w-11 items-center text-sm text-foreground/80 hover:text-foreground hover:underline hover:underline-offset-4";

const COLS: [string, [string, string][]][] = [
  ["Product", [["How it works", "/how-it-works"], ["Pricing", "/pricing"]]],
  // Filled in on the client: Log in and Start free, or Dashboard for someone signed in
  ["Creators", []],
  ["Buyers", [["Find my order", "/lookup"], ["Refunds and support", "/lookup#help"]]],
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="gutter mx-auto grid grid-cols-1 max-w-[1200px] gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Add a product, share a link, get paid. Made in India for creators who sell everywhere.
          </p>
        </div>
        {COLS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="eyebrow mb-3">{title}</p>
            <ul className="flex flex-col">
              {title === "Creators" ? (
                <CreatorLinks className={LINK} />
              ) : (
                links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className={LINK}>
                      {label}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </nav>
        ))}
      </div>
      <div className="gutter mx-auto flex max-w-[1200px] flex-col gap-2 border-t py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>© 2026 PowerProof. Payments handled by a licensed payment gateway.</p>
        <p className="font-mono">Made with too much chai in Mumbai.</p>
      </div>
    </footer>
  );
}
