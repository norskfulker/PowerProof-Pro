import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Store", template: "%s" },
  robots: { index: true },
};

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
