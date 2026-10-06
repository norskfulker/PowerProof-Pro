import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/pp/logo";

export const metadata: Metadata = { title: "Email previews" };

export default function EmailsLayout({ children }: { children: React.ReactNode }) {
  return (
    // Emails are always light: mail apps don't follow the site theme
    <div data-theme="light" className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-surface">
        <div className="gutter mx-auto flex h-16 max-w-[1200px] items-center gap-3">
          <Logo href="/dashboard" />
          <span className="eyebrow">Email previews</span>
          <Link href="/emails" className="ml-auto inline-flex min-h-11 items-center text-sm font-medium hover:underline">All emails</Link>
        </div>
      </header>
      <main id="main" className="gutter mx-auto max-w-[1200px] py-8">{children}</main>
    </div>
  );
}
