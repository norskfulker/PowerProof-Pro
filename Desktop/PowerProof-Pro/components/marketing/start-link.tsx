"use client";

import Link from "next/link";
import { useAccount } from "@/components/auth/use-account";

/**
 * A "Start free" link on the marketing site. For someone already signed in it goes to their
 * dashboard instead (and says so), so a creator never sees sign-up prompts for an account they have.
 */
export function StartLink({ children, signedIn = "Go to dashboard", href = "/signup", ...props }: Omit<React.ComponentProps<typeof Link>, "href"> & { href?: string; signedIn?: React.ReactNode }) {
  const account = useAccount();
  const inside = account.status === "in";
  return (
    <Link href={inside ? "/dashboard" : href} {...props}>
      {inside ? signedIn : children}
    </Link>
  );
}

/** The footer's "Creators" links: log in and sign up, or the way back in for someone signed in */
export function CreatorLinks({ className }: { className?: string }) {
  const account = useAccount();
  const links: [string, string][] = account.status === "in" ? [["Dashboard", "/dashboard"], ["Settings", "/settings/profile"]] : [["Log in", "/login"], ["Start free", "/signup"]];
  return links.map(([label, href]) => (
    <li key={href}>
      <Link href={href} className={className}>
        {label}
      </Link>
    </li>
  ));
}
