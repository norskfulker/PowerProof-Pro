import type { Metadata } from "next";
import Link from "next/link";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ComingSoon } from "@/components/pp/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Invoice" };

export default function Page() {
  return (
    <BuyerShell narrow>
      <ComingSoon
        title="Invoices open soon"
        body="GST invoices are issued with paid orders, which start once payments are connected."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Back to PowerProof</Link>
          </Button>
        }
      />
    </BuyerShell>
  );
}
