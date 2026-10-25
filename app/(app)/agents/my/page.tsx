import { redirect } from "next/navigation";

/** The workspace's agents live in the Marketplace now, as its "Subscribed agents" tab */
export default function MyAgentsPage() {
  redirect("/marketplace?tab=subscribed");
}
