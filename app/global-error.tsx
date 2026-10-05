"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-start justify-center gap-4 px-6">
        <p className="font-display text-[6rem] leading-none text-accent-strong">500</p>
        <h1 className="text-3xl">PowerProof hit a snag.</h1>
        <p className="text-muted-foreground">Reload to try again. Your data is safe.</p>
        <button onClick={reset} className="h-11 rounded-control bg-primary px-5 font-semibold text-primary-foreground">Reload</button>
      </body>
    </html>
  );
}
