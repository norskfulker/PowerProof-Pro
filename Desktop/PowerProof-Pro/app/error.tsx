"use client";

import { Button } from "@/components/ui/button";
import { SystemPage } from "@/components/pp/system-page";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SystemPage
      code="500"
      title="Something broke on our side."
      body={`It's not you. Try again in a moment; if it keeps happening, mention code ${error.digest ?? "PP-500"} to support.`}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
