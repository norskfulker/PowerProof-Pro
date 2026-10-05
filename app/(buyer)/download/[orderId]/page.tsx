"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { useApi } from "@/hooks/use-api";
import { getOrderForSuccess } from "@/lib/api";

/** Old download links now forward to the secure order page. */
export default function LegacyDownloadPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { data, error, reload } = useApi(() => getOrderForSuccess(orderId), [orderId]);
  const token = data?.order.token;
  useEffect(() => {
    if (token) router.replace(`/order/${token}`);
  }, [token, router]);
  return <BuyerStatus error={error} onRetry={reload} kind="order" />;
}
