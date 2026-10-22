import type { Metadata } from "next";

export const metadata: Metadata = { title: "Team invite", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
