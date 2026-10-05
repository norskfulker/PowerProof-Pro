import type { Metadata } from "next";
import { Logo } from "@/components/pp/logo";

export const metadata: Metadata = { title: "Set up your store" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter mx-auto flex h-16 w-full max-w-[1200px] items-center">
        <Logo href={null} />
      </header>
      <main id="main" className="gutter flex flex-1 justify-center pt-4 pb-16 md:pt-10">
        <div className="w-full max-w-[600px]">{children}</div>
      </main>
    </div>
  );
}
