import type { Metadata } from "next";
import Link from "next/link";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ComingSoon } from "@/components/pp/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Checkout" };

export default function Page() {
  return (
    <BuyerShell narrow>
      <ComingSoon
        title="Checkout opens soon"
        body="Buying is switched on once payments are connected. The creator's products are all here to look at in the meantime."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Back to PowerProof</Link>
          </Button>
        }
      />
    </BuyerShell>
  );
}
