import Link from "next/link";
import { BadgeCheck, Clock, Flame, ShieldCheck, Star } from "lucide-react";
import { MoneyText } from "@/components/pp/money-text";
import { DealLinks } from "./deal-links";
import type { Deal } from "@/lib/api";
import { countryByCode, flagOf } from "@/lib/countries";
import { convert, type Rates } from "@/lib/fx";
import { formatNumber } from "@/lib/format";
import type { CurrencyCode, Money } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "/month" or "/year" for a subscription, nothing for a one-time purchase */
export const perLabel = (d: Pick<Deal, "billing" | "interval">) => (d.billing === "subscription" ? (d.interval === "year" ? "/year" : "/month") : "");

/** Prices in the viewer's currency when rates are loaded; otherwise as the seller set them */
export interface Show {
  currency: CurrencyCode;
  rates: Rates;
}
const shown = (m: Money, s?: Show): Money => (s ? convert(m, s.currency, s.rates) : m);
const converted = (d: Deal, s?: Show) => !!s && shown(d.price, s).currency !== d.price.currency;

export function DealBadges({ d, className }: { d: Pick<Deal, "verified" | "trusted">; className?: string }) {
  if (!d.verified && !d.trusted) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Trust badges">
      {d.verified && (
        <li title="PowerProof has checked this seller and the deal" className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
          <BadgeCheck className="size-3.5" aria-hidden /> Verified
        </li>
      )}
      {d.trusted && (
        <li title="Enough paid orders, few refunds and good reviews" className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
          <ShieldCheck className="size-3.5" aria-hidden /> Trusted seller
        </li>
      )}
    </ul>
  );
}

/** A round mark for the seller: their initials on the brand colour */
function SellerMark({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
  return <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-[0.6875rem] font-semibold text-primary">{initials}</span>;
}

function Cover({ d, className }: { d: Deal; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)} style={!d.cover ? { background: `linear-gradient(135deg, ${d.coverBg ?? "#0F3D33"}, color-mix(in oklab, ${d.coverBg ?? "#0F3D33"} 55%, black))` } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {d.cover ? <img src={d.cover} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <span className="grid size-full place-items-end p-4 font-display text-2xl leading-tight text-white [overflow-wrap:anywhere]">{d.title}</span>}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
      <span className="absolute top-3 left-3 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground shadow-sm">{d.percentOff}% off</span>
    </div>
  );
}

function Seller({ d }: { d: Deal }) {
  const c = countryByCode(d.country);
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <SellerMark name={d.storeName} />
      <span className="min-w-0 truncate font-medium text-foreground">{d.storeName}</span>
      {d.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified seller" />}
      {d.trusted && <ShieldCheck className="size-4 shrink-0 text-success" aria-label="Trusted seller" />}
      <span className="ml-auto shrink-0" title={c.name}><span aria-hidden>{flagOf(d.country)}</span><span className="sr-only">{c.name}</span></span>
    </p>
  );
}

function Price({ d, show, big = false }: { d: Deal; show?: Show; big?: boolean }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="sr-only">Our price</span>
      <span className={cn("font-display leading-none", big ? "text-4xl" : "text-3xl")}>
        {converted(d, show) && <span className="mr-0.5 text-base font-normal text-muted-foreground" aria-label="about">≈</span>}
        <MoneyText value={shown(d.price, show)} />
        {perLabel(d) && <span className="text-sm font-normal text-muted-foreground">{perLabel(d)}</span>}
      </span>
      <span className="sr-only">Original price</span>
      <MoneyText value={shown(d.original, show)} className="text-sm text-muted-foreground line-through" />
    </p>
  );
}

/** How it is doing, in one line: rating and units sold (revenue on hover when the seller shares it) */
function Stats({ d, show }: { d: Deal; show?: Show }) {
  return (
    <p className="flex items-center gap-3 text-xs text-muted-foreground">
      {d.rating !== undefined && <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-accent text-accent" aria-hidden /><span className="font-semibold text-foreground">{d.rating.toFixed(1)}</span><span className="sr-only">stars</span></span>}
      <span className="inline-flex items-center gap-1"><Flame className="size-3.5 text-accent" aria-hidden />{formatNumber(d.sold)} sold</span>
      {d.revenue && <span className="sr-only">Revenue <MoneyText value={shown(d.revenue, show)} compact /></span>}
      {ends(d)}
    </p>
  );
}

const ends = (d: Deal) => d.endsAt && <span className="ml-auto inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> Ends {new Date(d.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>;

const frame = "group flex h-full flex-col overflow-hidden rounded-card border bg-surface shadow-sm";
const lift = "transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg motion-reduce:hover:translate-y-0";

/**
 * A marketplace deal: the cover, the seller (with their country and badges), what it is, the
 * original price crossed out next to the deal price, and one line on how it is doing.
 * The creator's preview uses this same card.
 *
 * `href` sends the card somewhere other than its storefront page — the creator's own list links to
 * the deal's edit screen. `hideSeller` drops the seller row, which is the viewer themselves.
 */
export function DealCard({ d, preview = false, show, href, hideSeller = false }: { d: Deal; preview?: boolean; show?: Show; href?: string; hideSeller?: boolean }) {
  const body = (
    <>
      <Cover d={d} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        {!hideSeller && <Seller d={d} />}
        <div className="flex flex-col gap-1.5">
          <h2 className="font-sans text-base leading-snug font-bold tracking-normal [overflow-wrap:anywhere]">{d.title}</h2>
          <p className="line-clamp-1 text-sm text-muted-foreground">{d.pitch}</p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <Price d={d} show={show} />
          <Stats d={d} show={show} />
        </div>
      </div>
    </>
  );
  return preview ? (
    <article className={frame}>{body}</article>
  ) : (
    <article className={cn(frame, lift)}>
      <Link href={href ?? `/s/${d.storeSlug}/${d.productSlug}`} className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-primary" aria-label={href ? `Edit ${d.title}` : `${d.title} from ${d.storeName}`}>
        {body}
      </Link>
      {/* Browsing: the product's direct link and Copy this site (not on the creator's own list) */}
      {!href && <DealLinks d={d} />}
    </article>
  );
}

/** The big card for the best performers at the top of the marketplace */
export function SpotlightCard({ d, rank, show }: { d: Deal; rank: number; show?: Show }) {
  return (
    <article className={cn(frame, lift)}>
      <Link href={`/s/${d.storeSlug}/${d.productSlug}`} className="flex w-full flex-1 flex-col focus-visible:outline-2 focus-visible:outline-primary md:flex-row" aria-label={`${d.title} from ${d.storeName}`}>
        <div className="relative md:w-2/5 md:shrink-0">
          <Cover d={d} className="aspect-[16/10] h-full md:aspect-auto" />
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-xs font-semibold text-white backdrop-blur">#{rank} best seller</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <Seller d={d} />
          <h2 className="font-display text-2xl leading-tight [overflow-wrap:anywhere]">{d.title}</h2>
          <p className="line-clamp-2 text-muted-foreground">{d.pitch}</p>
          <div className="mt-auto flex flex-col gap-3">
            <Price d={d} show={show} big />
            <Stats d={d} show={show} />
          </div>
        </div>
      </Link>
      <DealLinks d={d} />
    </article>
  );
}
