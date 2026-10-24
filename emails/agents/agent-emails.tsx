import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, KeyValue, button, eyebrow, h1, muted, p } from "../layout";

/**
 * Emails PowerProof Agents send to the store owner (never to their customers): the weekly report,
 * a broken connection, and the end of the trial. Copy says "paid after a reminder", never
 * "recovered by us".
 */

const brand = (storeName: string) => ({ name: storeName, logoText: "PA", color: "#0B5C45" });

export function WeeklyReportEmail(props: {
  storeName: string;
  agentName: string;
  week: string;
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
    <EmailLayout preview={`${props.paidAfterReminder} paid after reminders this week`} brand={brand(props.storeName)} footer={<Text style={muted}>You get this every Monday at 9:00. Turn it off in the agent&apos;s Settings.</Text>}>
      <Text style={eyebrow}>{props.agentName} · {props.week}</Text>
      <Heading as="h1" style={h1}>{props.paidAfterReminder} paid after a reminder</Heading>
      <Text style={p}>
        {props.paidAfterReminderCount === 1 ? "One invoice was" : `${props.paidAfterReminderCount} invoices were`} marked paid within 14 days of a reminder.
      </Text>
      <KeyValue
        rows={[
          ["Overdue now", `${props.overdueNow} (${props.overdueCount})`],
          ...props.sent,
          ["Customers to call", String(props.personalCalls)],
          ["WhatsApp messages waiting", String(props.whatsappWaiting)],
        ]}
      />
      <Section style={{ margin: "24px 0 0" }}>
        <Button href={props.dashboardUrl} style={button}>{props.whatsappWaiting ? "Send waiting messages" : "Open your dashboard"}</Button>
      </Section>
    </EmailLayout>
  );
}

export function ConnectionBrokenEmail(props: { storeName: string; connection: string; agents: string[]; problem: string; fixUrl: string }) {
  return (
    <EmailLayout preview={`${props.connection} needs you`} brand={brand(props.storeName)}>
      <Text style={eyebrow}>Connection problem</Text>
      <Heading as="h1" style={h1}>{props.connection} stopped working</Heading>
      <Text style={p}>{props.problem}</Text>
      <Text style={p}>Paused until it&apos;s fixed: {props.agents.join(", ")}. Nothing was deleted, and nothing goes out while it&apos;s paused.</Text>
      <Section style={{ margin: "8px 0 0" }}>
        <Button href={props.fixUrl} style={button}>Fix the connection</Button>
      </Section>
    </EmailLayout>
  );
}

export function TrialEndedEmail(props: { storeName: string; agentName: string; credits: number; url: string }) {
  return (
    <EmailLayout preview={`${props.agentName} has used its free credits`} brand={brand(props.storeName)}>
      <Text style={eyebrow}>{props.agentName}</Text>
      <Heading as="h1" style={h1}>Your free credits are used up</Heading>
      <Text style={p}>{props.agentName} used all {props.credits} free credits, so it has paused. Your customers, invoices and history are all kept.</Text>
      <Section style={{ margin: "8px 0 0" }}>
        <Button href={props.url} style={button}>See your results</Button>
      </Section>
    </EmailLayout>
  );
}
