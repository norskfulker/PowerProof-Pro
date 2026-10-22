import type { Metadata } from "next";

export const metadata: Metadata = { title: "Claim a store", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
