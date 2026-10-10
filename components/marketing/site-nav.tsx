"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LogOut, Menu, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAccount, type Account } from "@/components/auth/use-account";
import { logout } from "@/lib/api";
import { initials } from "@/lib/format";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/pp/logo";
import { SkipLink } from "@/components/pp/app-shell";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

type SignedIn = Extract<Account, { status: "in" }>;

/** A signed-in creator on the public site: their profile, with the way back to the dashboard. */
function ProfileMenu({ account }: { account: SignedIn }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Account: ${account.name}`} className="rounded-full">
          <Avatar className="size-9">
            <AvatarFallback className="bg-accent-soft font-semibold text-accent-ink">{initials(account.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block">{account.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{account.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard"><LayoutDashboard aria-hidden /> Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/profile"><Settings aria-hidden /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            router.refresh();
          }}
        >
          <LogOut aria-hidden /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const account = useAccount();
  const signedIn = account.status === "in" ? account : null;
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <SkipLink />
      <div className="gutter mx-auto flex h-16 max-w-[1200px] items-center gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1 pointer-coarse:gap-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-control px-3 text-sm font-medium hover:bg-muted pointer-coarse:min-h-11",
                    pathname === l.href ? "text-foreground" : "text-foreground/75"
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="max-sm:hidden" />
          {signedIn ? (
            <>
              <Button asChild variant="secondary" className="max-sm:hidden">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <ProfileMenu account={signedIn} />
            </>
          ) : account.status === "out" ? (
            <>
              <Button asChild variant="ghost" className="max-sm:hidden">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Start free</Link>
              </Button>
            </>
          ) : (
            // Until the session is read: hold the space so the bar doesn't jump
            <span className="h-10 w-24" aria-hidden />
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm p-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo />
              <nav aria-label="Mobile" className="mt-6">
                <ul className="flex flex-col gap-1">
                  {[...LINKS, signedIn ? { href: "/dashboard", label: "Dashboard" } : { href: "/login", label: "Log in" }].map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="flex min-h-12 items-center rounded-control px-3 font-display text-xl hover:bg-muted"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
                <span className="text-sm font-medium">Colour mode</span>
                <ThemeToggle iconOnly={false} />
              </div>
              {signedIn ? (
                <div className="mt-6 flex items-center gap-3 border-t pt-4">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-accent-soft font-semibold text-accent-ink">{initials(signedIn.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{signedIn.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">{signedIn.email}</span>
                  </span>
                </div>
              ) : (
                <Button asChild size="lg" className="mt-6 w-full">
                  <Link href="/signup" onClick={() => setOpen(false)}>
                    Start free
                  </Link>
                </Button>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
