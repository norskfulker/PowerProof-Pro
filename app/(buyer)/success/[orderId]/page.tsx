import type { Metadata } from "next";
import Link from "next/link";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ComingSoon } from "@/components/pp/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order" };

export default function Page() {
  return (
    <BuyerShell narrow>
      <ComingSoon
        title="Order pages open soon"
        body="Your order page and downloads appear here once payments are connected."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Back to PowerProof</Link>
          </Button>
        }
      />
    </BuyerShell>
  );
}
