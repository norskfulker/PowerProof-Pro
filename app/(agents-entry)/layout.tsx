import Link from "next/link";
import { Logo } from "@/components/pp/logo";

/** Pages between the public catalog and the app: starting an agent, and customers' opt-out links */
export default function AgentsEntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="gutter mx-auto flex h-16 w-full max-w-[960px] items-center">
        <Link href="/" aria-label="PowerProof home" className="inline-flex min-h-11 items-center">
          <Logo />
        </Link>
      </header>
      <main id="main" className="gutter mx-auto w-full max-w-[960px] flex-1 pb-16">
        {children}
      </main>
    </div>
  );
}
