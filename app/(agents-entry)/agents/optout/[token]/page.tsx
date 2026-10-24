import type { Metadata } from "next";
import { OptOut } from "@/components/agents/opt-out";

export const metadata: Metadata = { title: "Stop these reminders", robots: { index: false } };

/** A business's customer stops its reminders. The token names the message; it holds no address. */
export default async function OptOutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OptOut token={token} />;
}
