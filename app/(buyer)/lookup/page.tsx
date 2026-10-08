"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { lookupOrder } from "@/lib/api";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Lost your link? The email you bought with plus the order number brings your files back. */
export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("That email looks off. Check for typos.");
    if (ref.trim().length < 6) return setError("Enter the order number from your receipt, like PP/DP/ABCDE1234567.");
    setBusy(true);
    setError(undefined);
    try {
      return router.push(`/order/${await lookupOrder(email, ref)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't find that order.");
    }
    setBusy(false);
  }

  return (
    <BuyerShell narrow>
      <title>Find my order</title>
      <form noValidate onSubmit={find} className="flex flex-col gap-4 py-8">
        <h1 className="text-[1.75rem]">Find my order</h1>
        <p className="text-muted-foreground">Enter the email you bought with and your order number (it&apos;s on your receipt). We&apos;ll open your order and give you a fresh download link.</p>
        <div className="flex flex-col gap-1.5"><Label htmlFor="lk-email">Email</Label><Input id="lk-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="lk-ref">Order number</Label><Input id="lk-ref" className="font-mono uppercase" autoComplete="off" placeholder="PP/DP/ABCDE1234567" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full sm:w-fit">{busy ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />} Find my order</Button>
      </form>
    </BuyerShell>
  );
}
