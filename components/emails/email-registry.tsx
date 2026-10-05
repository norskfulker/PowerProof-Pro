import { LoginLinkEmail, NewSaleEmail, PayoutSentEmail, ReceiptEmail, type Brand } from "@/emails/templates";
import { formatDate, countryShort } from "@/lib/format";
import { formatMoney, sum } from "@/lib/money";
import type { Order, Payout, Store } from "@/lib/types";

export interface EmailContext {
  store: Store;
  order?: Order;
  payout?: Payout;
  todayOrders: Order[];
  origin: string;
}

export interface EmailDef {
  slug: string;
  name: string;
  to: string;
  description: string;
  subject: (c: EmailContext) => string;
  render: (c: EmailContext) => React.ReactElement;
}

const brand = (s: Store): Brand => ({ name: s.name, logoText: s.logoText, color: s.brandColor, supportEmail: s.supportEmail });

export const EMAILS: EmailDef[] = [
  {
    slug: "receipt",
    name: "Receipt with download",
    to: "Buyer",
    description: "Sent the moment a payment clears. The download link works without an account.",
    subject: (c) => `Your ${c.order?.productTitle ?? "download"} is ready`,
    render: (c) => (
      <ReceiptEmail
        brand={brand(c.store)}
        buyerName={c.order?.buyerName || "there"}
        productTitle={c.order?.productTitle ?? "Your product"}
        orderNumber={c.order?.number ?? "PP-0000"}
        invoiceNumber={c.order?.invoiceNumber ?? "INV-0000"}
        paid={c.order ? formatMoney(c.order.buyerTotal) : "₹0.00"}
        date={c.order ? formatDate(c.order.paidAt ?? c.order.createdAt, { time: true }) : ""}
        method={(c.order?.paymentMethod ?? "upi").toUpperCase()}
        downloadUrl={`${c.origin}/download/${c.order?.id ?? ""}`}
        invoiceUrl={`${c.origin}/invoice/${c.order?.id ?? ""}`}
        refundDays={c.store.refundDays}
      />
    ),
  },
  {
    slug: "new-sale",
    name: "New sale alert",
    to: "Creator",
    description: "One per sale, with what you keep. Can be switched off in Settings › Profile.",
    subject: (c) => `New sale: ${c.order?.productTitle ?? "a product"} · ${c.order ? formatMoney(c.order.total) : ""}`,
    render: (c) => (
      <NewSaleEmail
        brand={brand(c.store)}
        productTitle={c.order?.productTitle ?? "Your product"}
        buyer={c.order?.buyerName.split(" ")[0] || "Someone"}
        country={c.order ? countryShort(c.order.countryCode) : "India"}
        paid={c.order ? formatMoney(c.order.total) : "₹0.00"}
        keep={c.order ? formatMoney(c.order.net) : "₹0.00"}
        orderUrl={`${c.origin}/orders/${c.order?.id ?? ""}`}
        todayCount={c.todayOrders.length}
        todayTotal={formatMoney(sum(c.todayOrders.map((o) => o.total)))}
      />
    ),
  },
  {
    slug: "payout-sent",
    name: "Payout sent",
    to: "Creator",
    description: "When a withdrawal leaves for the bank, with the UTR to trace it.",
    subject: (c) => `${c.payout ? formatMoney(c.payout.amount) : "Your payout"} is on its way`,
    render: (c) => (
      <PayoutSentEmail
        brand={brand(c.store)}
        amount={c.payout ? formatMoney(c.payout.amount) : "₹0.00"}
        method={c.payout?.methodLabel ?? "your bank"}
        reference={c.payout?.reference ?? "Pending from bank"}
        date={c.payout ? formatDate(c.payout.createdAt, { time: true }) : ""}
        payoutsUrl={`${c.origin}/payouts`}
      />
    ),
  },
  {
    slug: "login-link",
    name: "Login link",
    to: "Creator",
    description: "Passwordless sign-in. The same layout handles password resets.",
    subject: () => "Your PowerProof login link",
    render: (c) => <LoginLinkEmail email={c.store.ownerEmail} url={`${c.origin}/dashboard`} code="482 913" />,
  },
];
