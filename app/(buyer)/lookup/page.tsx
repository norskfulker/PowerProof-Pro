import type { Metadata } from "next";
import Link from "next/link";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ComingSoon } from "@/components/pp/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Find my order" };

export default function Page() {
  return (
    <BuyerShell narrow>
      <ComingSoon
        title="Order lookup opens soon"
        body="Finding an order by email needs emails and payments, which are being connected. Nothing is lost: orders will be here when they are."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Back to PowerProof</Link>
          </Button>
        }
      />
    </BuyerShell>
  );
}
