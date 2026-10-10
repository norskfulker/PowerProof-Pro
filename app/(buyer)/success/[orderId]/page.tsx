"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrderPage } from "@/components/buyer/order-view";

/** Where a buyer lands right after paying: the link token travels in the address. */
export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  return <OrderPage token={useSearchParams().get("t")} justPaid />;
}
