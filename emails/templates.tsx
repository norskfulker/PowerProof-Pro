import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { EmailLayout, KeyValue, button, eyebrow, h1, muted, p } from "./layout";
import { t } from "./theme";

export interface Brand {
  name: string;
  logoText: string;
  color: string;
  supportEmail: string;
}

/* 1. Buyer receipt with download link ------------------------------------- */
export function ReceiptEmail(props: {
  brand: Brand;
  buyerName: string;
  productTitle: string;
  orderNumber: string;
  invoiceNumber: string;
  paid: string;
  date: string;
  method: string;
  downloadUrl: string;
  invoiceUrl: string;
  refundDays: number;
}) {
  return (
    <EmailLayout
      preview={`Your ${props.productTitle} is ready to download`}
      brand={props.brand}
      footer={<Text style={muted}>Questions? Just reply. It goes to {props.brand.name} at {props.brand.supportEmail}.</Text>}
    >
      <Text style={eyebrow}>Receipt · {props.orderNumber}</Text>
      <Heading as="h1" style={h1}>It&apos;s yours, {props.buyerName.split(" ")[0]}.</Heading>
      <Text style={p}>Thanks for buying <strong>{props.productTitle}</strong>. Your download is one tap away and the link keeps working.</Text>
      <Section style={{ margin: "8px 0 24px" }}>
        <Button href={props.downloadUrl} style={button}>Download now</Button>
      </Section>
      <KeyValue rows={[["Item", props.productTitle], ["Paid", props.paid], ["Date", props.date], ["Paid with", props.method], ["Invoice", props.invoiceNumber]]} />
      <Text style={{ ...muted, marginTop: 20 }}>
        <Link href={props.invoiceUrl} style={{ color: t.emerald }}>Tax invoice</Link> · Refunds within {props.refundDays} days from your download page.
      </Text>
    </EmailLayout>
  );
}

/* 2. Creator: new sale ------------------------------------------------------- */
export function NewSaleEmail(props: { brand: Brand; productTitle: string; buyer: string; country: string; paid: string; keep: string; orderUrl: string; todayTotal: string; todayCount: number }) {
  return (
    <EmailLayout preview={`New sale: ${props.productTitle} · ${props.paid}`} brand={{ ...props.brand, name: "PowerProof" , color: t.emerald, logoText: "PP" }}>
      <Text style={eyebrow}>New sale</Text>
      <Heading as="h1" style={h1}>Ka-ching. {props.paid}</Heading>
      <Text style={p}>{props.buyer} in {props.country} just bought <strong>{props.productTitle}</strong>. The file is already in their inbox.</Text>
      <Section style={{ backgroundColor: t.emeraldSoft, borderRadius: t.radiusControl, padding: "16px 18px", margin: "8px 0 20px" }}>
        <Text style={{ ...eyebrow, margin: 0 }}>You keep</Text>
        <Text style={{ fontFamily: t.display, fontWeight: 800, fontSize: 28, color: t.brassStrong, margin: "4px 0 0" }}>{props.keep}</Text>
        <Text style={{ ...muted, margin: "4px 0 0" }}>Available to withdraw in 2 days.</Text>
      </Section>
      <Button href={props.orderUrl} style={button}>See the order</Button>
      <Text style={{ ...muted, marginTop: 20 }}>Today so far: {props.todayCount} sales, {props.todayTotal}.</Text>
    </EmailLayout>
  );
}

/* 3. Creator: payout sent --------------------------------------------------- */
export function PayoutSentEmail(props: { brand: Brand; amount: string; method: string; reference: string; date: string; payoutsUrl: string }) {
  return (
    <EmailLayout preview={`${props.amount} is on its way to ${props.method}`} brand={{ ...props.brand, name: "PowerProof", color: t.emerald, logoText: "PP" }}>
      <Text style={eyebrow}>Payout sent</Text>
      <Heading as="h1" style={h1}>{props.amount} is on its way.</Heading>
      <Text style={p}>We sent it to {props.method}. Most banks show it within a few hours; some take until the next working day.</Text>
      <KeyValue rows={[["Amount", props.amount], ["To", props.method], ["Reference (UTR)", props.reference], ["Sent", props.date]]} />
      <Section style={{ marginTop: 24 }}>
        <Button href={props.payoutsUrl} style={button}>View payouts</Button>
      </Section>
      <Text style={{ ...muted, marginTop: 20 }}>Not there by tomorrow evening? Reply with the reference and we&apos;ll chase it.</Text>
    </EmailLayout>
  );
}

/* 4. Login link (also used for password reset) ------------------------------ */
export function LoginLinkEmail(props: { email: string; url: string; code: string; reset?: boolean }) {
  return (
    <EmailLayout preview={props.reset ? "Reset your PowerProof password" : "Your PowerProof login link"} brand={{ name: "PowerProof", logoText: "PP", color: t.emerald }}>
      <Heading as="h1" style={h1}>{props.reset ? "Set a new password" : "Here's your login link"}</Heading>
      <Text style={p}>{props.reset ? "Tap below to choose a new password." : "Tap below and you're in. No password needed."} It works once and expires in {props.reset ? "30" : "15"} minutes.</Text>
      <Section style={{ margin: "8px 0 24px" }}>
        <Button href={props.url} style={button}>{props.reset ? "Reset password" : "Log in to PowerProof"}</Button>
      </Section>
      <Text style={muted}>Or enter this code: <span style={{ fontFamily: t.mono, fontSize: 18, letterSpacing: "0.2em", color: t.ink }}>{props.code}</span></Text>
      <Text style={muted}>Didn&apos;t ask for this? Ignore it; nobody can log in without the link. Requested for {props.email}.</Text>
    </EmailLayout>
  );
}
