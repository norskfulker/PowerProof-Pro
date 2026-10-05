import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function SystemPage({
  code,
  title,
  body,
  action,
}: {
  code: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter mx-auto flex h-16 w-full max-w-[1200px] items-center"><Logo /></header>
      <main id="main" className="gutter mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 pb-24">
        <p className="font-display text-[96px] leading-none text-accent-strong md:text-[128px]">{code}</p>
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        <p className="text-lg text-muted-foreground">{body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {action}
          <Button asChild variant="secondary"><Link href="/lookup">Find my order</Link></Button>
        </div>
      </main>
    </div>
  );
}
