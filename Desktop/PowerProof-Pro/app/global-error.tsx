"use client";

import "./globals.css";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-start justify-center gap-4 px-6">
        <p className="font-display text-[6rem] leading-none text-accent-strong">500</p>
        <h1 className="text-3xl">PowerProof hit a snag.</h1>
        <p className="text-muted-foreground">Reload to try again. Your data is safe.</p>
        <Button onClick={reset}>Reload</Button>
      </body>
    </html>
  );
}
