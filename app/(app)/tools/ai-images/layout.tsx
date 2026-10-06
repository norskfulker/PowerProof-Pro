import type { Metadata } from "next";

export const metadata: Metadata = { title: "Image maker" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
