"use client";

import { useEffect } from "react";
import type { AgentInstance } from "@/lib/types/agents";
import type { AgentUi } from "../../ui";
import { CustomersView } from "./customers";
import { ImportPanel } from "./import-panel";
import { InvoicesView } from "./invoices";
import { MessageView } from "./message";
import { ChaserOverview, ChaserPreviewSummary } from "./overview";
import { useChaser } from "./shared";
import { UploadView } from "./upload";

/** Wizard step 1: bring invoices in; ready once there's at least one */
function DataStep({ instance, onReady }: { instance: AgentInstance; onReady: (ready: boolean) => void }) {
  const { derived } = useChaser();
  const count = derived?.invoices.length ?? 0;
  useEffect(() => onReady(count > 0), [count, onReady]);
  return (
    <div className="flex flex-col gap-4">
      {count > 0 && <p className="rounded-control bg-success-soft px-3 py-2 text-sm">{count.toLocaleString("en-IN")} invoices are in. Add more, or carry on.</p>}
      <ImportPanel instance={instance} />
    </div>
  );
}

export const chaserUi: AgentUi = {
  DataStep,
  PreviewSummary: ChaserPreviewSummary,
  Overview: ChaserOverview,
  views: { customers: CustomersView, invoices: InvoicesView, message: MessageView, upload: UploadView },
  links: [
    { view: "customers", label: "Customers" },
    { view: "invoices", label: "Invoices" },
    { view: "upload", label: "Upload and data" },
  ],
};
