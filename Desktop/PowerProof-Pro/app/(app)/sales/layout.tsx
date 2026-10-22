import { AnalyticsTabs } from "@/components/nav/nav-tabs";

/** Orders, Customers, Leads and Payouts sit under Analytics: the same row of tabs on each list */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsTabs />
      {children}
    </>
  );
}
