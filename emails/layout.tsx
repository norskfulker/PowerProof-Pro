import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import { t } from "./theme";

export function EmailLayout({
  preview,
  brand,
  children,
  footer,
}: {
  preview: string;
  brand: { name: string; logoText: string; color: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: t.porcelain, fontFamily: t.body, color: t.ink, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
          <Section style={{ padding: "8px 0 16px" }}>
            <table role="presentation" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: brand.color, color: t.porcelain, fontFamily: t.mono, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{brand.logoText}</td>
                  <td style={{ paddingLeft: 10, fontFamily: t.display, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{brand.name}</td>
                </tr>
              </tbody>
            </table>
          </Section>
          <Section style={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radiusCard, padding: "28px 24px" }}>{children}</Section>
          <Section style={{ padding: "16px 4px" }}>
            {footer}
            <Hr style={{ borderColor: t.border, margin: "12px 0" }} />
            <Text style={{ fontSize: 12, color: t.muted, margin: 0 }}>
              Sent by <Link href="https://powerproof.store" style={{ color: t.muted, textDecoration: "underline" }}>PowerProof</Link> on behalf of {brand.name}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const h1 = { fontFamily: t.display, fontWeight: 800, fontSize: 28, lineHeight: "1.15", letterSpacing: "-0.02em", margin: "0 0 8px" } as const;
export const p = { fontSize: 16, lineHeight: "1.5", margin: "0 0 16px", color: t.ink } as const;
export const muted = { ...p, color: t.muted, fontSize: 14 } as const;
export const eyebrow = { fontFamily: t.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: t.muted, margin: "0 0 6px" } as const;
export const button = {
  display: "inline-block",
  backgroundColor: t.emerald,
  color: t.porcelain,
  fontWeight: 600,
  fontSize: 16,
  padding: "14px 24px",
  borderRadius: t.radiusControl,
  textDecoration: "none",
} as const;

export function KeyValue({ rows }: { rows: [string, string][] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderTop: `1px dashed ${t.border}`, marginTop: 8 }}>
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={k}>
            <td style={{ padding: "10px 0", fontSize: 14, color: t.muted, borderBottom: i < rows.length - 1 ? `1px solid ${t.border}` : undefined }}>{k}</td>
            <td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", fontFamily: t.mono, borderBottom: i < rows.length - 1 ? `1px solid ${t.border}` : undefined }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
