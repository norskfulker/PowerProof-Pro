"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { StepProgress } from "@/components/pp/step-progress";
import { StepBusiness } from "@/components/onboarding/step-business";
import { StepPayout } from "@/components/onboarding/step-payout";
import { StepProduct } from "@/components/onboarding/step-product";
import { StepPublish } from "@/components/onboarding/step-publish";
import { StepStore } from "@/components/onboarding/step-store";
import { useApi } from "@/hooks/use-api";
import { getCompany, getStore } from "@/lib/api";
import type { Product } from "@/lib/types";

// Step 6 (Domain) is optional and shown on the "you're live" screen
const STEPS = ["Store", "Business", "Payouts", "Product", "Publish", "Domain"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState<Product>();
  const [bankAdded, setBankAdded] = useState(false);
  const store = useApi(getStore, [step]);
  const company = useApi(getCompany, []);

  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  let body: React.ReactNode;
  if (store.error || company.error) {
    body = <ErrorState message={store.error ?? company.error} onRetry={() => { store.reload(); company.reload(); }} />;
  } else if (!store.data || !company.data) {
    body = <Skeleton className="h-[460px] w-full rounded-dialog" />;
  } else if (step === 0) {
    body = <StepStore initial={{ name: store.data.name, slug: store.data.slug }} onDone={() => go(1)} />;
  } else if (step === 1) {
    body = <StepBusiness initial={{ ...company.data, ownerName: store.data.ownerName }} onBack={() => go(0)} onDone={() => go(2)} />;
  } else if (step === 2) {
    body = (
      <StepPayout
        ownerName={store.data.ownerName}
        onBack={() => go(1)}
        onDone={(added) => {
          setBankAdded(added);
          go(3);
        }}
      />
    );
  } else if (step === 3) {
    body = (
      <StepProduct
        onBack={() => go(2)}
        onDone={(p) => {
          setProduct(p);
          go(4);
        }}
      />
    );
  } else {
    body = <StepPublish store={store.data} product={product} bankAdded={bankAdded} onBack={() => go(3)} onPublished={() => setStep(5)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <StepProgress steps={STEPS} current={step} />
      {body}
    </div>
  );
}
