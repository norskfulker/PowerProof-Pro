import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import { a, button, eyebrow, GEIST_CSS, h1, p, small, wordmark } from "./style";

/**
 * Emails PowerProof Agents send to the store owner (never to their customers): the weekly report,
 * a broken connection, and the end of the trial. Same look as the reminders (style.ts): Geist, the
 * PowerProof wordmark as plain ExtraBold text, one white card. Copy says "paid after a reminder",
 * never "recovered by us".
 */

function AgentEmailLayout({ preview, storeName, footer, children }: { preview: string; storeName: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href={GEIST_CSS} rel="stylesheet" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: a.page, margin: 0, padding: "32px 0", fontFamily: a.font }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
          <Section style={{ padding: "0 4px 20px" }}>
            <Text style={wordmark}>PowerProof</Text>
          </Section>
          <Section style={{ backgroundColor: a.card, border: `1px solid ${a.border}`, borderRadius: a.radius, padding: "28px 26px" }}>{children}</Section>
          <Section style={{ padding: "16px 4px 0" }}>
            {footer}
            <Text style={small}>PowerProof Agents, for {storeName}.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Label and value rows, one per line */
function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderTop: `1px solid ${a.border}`, margin: "8px 0 0" }}>
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={k}>
            <td style={{ padding: "12px 0", fontFamily: a.font, fontSize: 14, color: a.muted, borderBottom: i < rows.length - 1 ? `1px solid ${a.border}` : undefined }}>{k}</td>
            <td style={{ padding: "12px 0", fontFamily: a.font, fontSize: 15, fontWeight: 600, color: a.ink, textAlign: "right", borderBottom: i < rows.length - 1 ? `1px solid ${a.border}` : undefined }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WeeklyReportEmail(props: {
  storeName: string;
  agentName: string;
  week: string;
  /** A daily report (yesterday) instead of the Monday one */
  daily?: boolean;
  paidAfterReminder: string;
  paidAfterReminderCount: number;
  overdueNow: string;
  overdueCount: number;
  sent: [string, string][];
  personalCalls: number;
  whatsappWaiting: number;
  dashboardUrl: string;
}) {
  return (
    <AgentEmailLayout
      preview={`${props.paidAfterReminder} paid after reminders ${props.daily ? "yesterday" : "this week"}`}
      storeName={props.storeName}
      footer={<Text style={{ ...small, margin: "0 0 6px" }}>You get this {props.daily ? "every day" : "every Monday"} at 9:00. Change or turn it off in the agent&apos;s Schedule.</Text>}
    >
      <Text style={eyebrow}>
        {props.agentName} · {props.week}
      </Text>
      <Heading as="h1" style={h1}>
        {props.paidAfterReminder} paid after a reminder
      </Heading>
      <Text style={p}>{props.paidAfterReminderCount === 1 ? "One invoice was" : `${props.paidAfterReminderCount} invoices were`} marked paid within 14 days of a reminder.</Text>
      <Rows rows={[["Overdue now", `${props.overdueNow} (${props.overdueCount})`], ...props.sent, ["Customers to call", String(props.personalCalls)], ["WhatsApp messages waiting", String(props.whatsappWaiting)]]} />
      <Section style={{ margin: "24px 0 0" }}>
        <Button href={props.dashboardUrl} style={button}>
          {props.whatsappWaiting ? "Send waiting messages" : "Open your dashboard"}
        </Button>
      </Section>
    </AgentEmailLayout>
  );
}

export function ConnectionBrokenEmail(props: { storeName: string; connection: string; agents: string[]; problem: string; fixUrl: string }) {
  return (
    <AgentEmailLayout preview={`${props.connection} needs you`} storeName={props.storeName}>
      <Text style={eyebrow}>Connection problem</Text>
      <Heading as="h1" style={h1}>
        {props.connection} stopped working
      </Heading>
      <Text style={p}>{props.problem}</Text>
      <Text style={p}>Paused until it&apos;s fixed: {props.agents.join(", ")}. Nothing was deleted, and nothing goes out while it&apos;s paused.</Text>
      <Section style={{ margin: "8px 0 0" }}>
        <Button href={props.fixUrl} style={button}>
          Fix the connection
        </Button>
      </Section>
    </AgentEmailLayout>
  );
}

export function TrialEndedEmail(props: { storeName: string; agentName: string; credits: number; url: string }) {
  return (
    <AgentEmailLayout preview={`${props.agentName} has used its free credits`} storeName={props.storeName}>
      <Text style={eyebrow}>{props.agentName}</Text>
      <Heading as="h1" style={h1}>
        Your free credits are used up
      </Heading>
      <Text style={p}>
        {props.agentName} used all {props.credits} free credits, so it has paused. Your customers, invoices and history are all kept.
      </Text>
      <Section style={{ margin: "8px 0 0" }}>
        <Button href={props.url} style={button}>
          See your results
        </Button>
      </Section>
    </AgentEmailLayout>
  );
}
