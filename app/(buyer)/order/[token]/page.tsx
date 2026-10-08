"use client";

import { use } from "react";
import { OrderPage } from "@/components/buyer/order-view";

/** The link in the receipt email: the token is the only key. */
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return <OrderPage token={use(params).token} />;
}
