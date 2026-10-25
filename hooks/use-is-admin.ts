"use client";

import { useEffect, useState } from "react";

/** Asked once per page load: whether the signed-in person is PowerProof staff (checked on the server) */
let ask: Promise<boolean> | undefined;
function askServer(): Promise<boolean> {
  ask ??= fetch("/api/admin/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ isAdmin: boolean }>) : { isAdmin: false }))
    .then((r) => r.isAdmin)
    .catch(() => {
      ask = undefined;
      return false;
    });
  return ask;
}

export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    askServer().then((a) => alive && setAdmin(a));
    return () => {
      alive = false;
    };
  }, []);
  return admin;
}

/** Staff workspaces report this many credits: shown as "Unlimited" */
export const UNLIMITED_CREDITS = 2_000_000_000;
export const isUnlimited = (credits: number | undefined) => (credits ?? 0) >= UNLIMITED_CREDITS;
