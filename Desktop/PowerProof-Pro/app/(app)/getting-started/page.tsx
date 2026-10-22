import { redirect } from "next/navigation";

/** Getting started is the first section of the dashboard. */
export default function GettingStartedPage() {
  redirect("/dashboard#getting-started");
}
