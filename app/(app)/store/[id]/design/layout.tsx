"use client";

import Link from "next/link";
import { use } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "base", label: "Base design", hint: "Colour, fonts, corners and logo for the whole store" },
  { href: "pages", label: "Pages", hint: "Launch, sale and link-in-bio pages built on it" },
] as const;

/** Design in two parts, in plain words: the base look of the whole store, and the pages on top of it. */
export default function DesignLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const path = usePathname();
  return (
    <>
      <nav aria-label="Design" className="mb-5 flex gap-1 border-b">
        {TABS.map((t) => {
          const active = path.includes(`/design/${t.href}`);
          return (
            <Link
              key={t.href}
              href={`/store/${id}/design/${t.href}`}
              aria-current={active ? "page" : undefined}
              title={t.hint}
              className={cn("-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
