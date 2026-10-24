"use client";

import { use } from "react";
import { AdminStoreView } from "@/components/agents/admin/store-view";

export default function AdminAgentStorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = use(params);
  return <AdminStoreView storeId={storeId} />;
}
