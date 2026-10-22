import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageCrumbs } from "@/components/nav/page-crumbs";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 md:mb-8", className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-sm font-medium text-muted-foreground hover:text-foreground pointer-fine:min-h-8">
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        {/* Where the page sits (a detail page has its Back link instead) */}
        {!back && <PageCrumbs title={title} />}
        <h1 className="text-[1.75rem] leading-[1.1] md:text-[2.125rem]">{title}</h1>
      </div>
      {/* Buttons sit on the title's row, at its end */}
      {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </header>
  );
}
