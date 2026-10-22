import Link from "next/link";
import { Logo } from "@/components/pp/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between">
        <Logo />
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          Back to site
        </Link>
      </header>
      <main id="main" className="gutter flex flex-1 items-start justify-center pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
      <footer className="gutter pb-6 text-center text-xs text-muted-foreground">
        By continuing you agree to the terms and the privacy policy.
      </footer>
    </div>
  );
}
