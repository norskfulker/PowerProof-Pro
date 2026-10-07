"use client";

import { ComingSoon } from "@/components/pp/coming-soon";
import { PageHeader } from "@/components/pp/page-header";

export default function StoreDomainPage() {
  return (
    <>
      <title>Domain · PowerProof</title>
      <PageHeader title="Domain" description="Where buyers find this store." />
      <ComingSoon title="Custom domains open soon." body="Your store already has its own address at /s/your-store-link. Connecting a domain you own needs DNS and certificate checks, which are being built." />
    </>
  );
}
