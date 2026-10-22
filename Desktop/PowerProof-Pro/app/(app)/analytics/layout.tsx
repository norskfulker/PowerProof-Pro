import type { Metadata } from "next";
import { AnalyticsTabs } from "@/components/nav/nav-tabs";

export const metadata: Metadata = { title: "Analytics" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsTabs />
      {children}
    </>
  );
}
