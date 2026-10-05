"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PayoutMethodCard } from "@/components/pp/payout-method-card";
import { BankForm } from "@/components/payouts/bank-form";
import { usdtPlaceholder } from "@/lib/api";
import { StepFrame } from "./step-frame";

export function StepPayout({ ownerName, onDone, onBack }: { ownerName: string; onDone: (added: boolean) => void; onBack: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <StepFrame
      formId="step-payout"
      title="Where should we send your money?"
      description="Sales become available two days after payment. You withdraw whenever you like."
      timeLeft="About 2 minutes to go"
      onBack={onBack}
      onSkip={() => onDone(false)}
      skipLabel="Add it later"
      submitLabel="Verify and continue"
      pending={pending}
    >
      <div className="flex flex-col gap-6">
        <div>
          <BankForm
            formId="step-payout"
            defaultName={ownerName}
            onPendingChange={setPending}
            onSaved={(m) => {
              toast.success("Bank account verified", { description: `${m.label} ····${m.last4}` });
              onDone(true);
            }}
          />
        </div>
        <div>
          <p className="eyebrow mb-2">Other ways to get paid</p>
          <PayoutMethodCard method={usdtPlaceholder()} />
        </div>
      </div>
    </StepFrame>
  );
}
