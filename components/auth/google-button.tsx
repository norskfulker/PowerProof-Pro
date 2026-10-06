"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/api";

/** Google's "G", drawn in its brand colours as Google's sign-in guidelines ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1h-4a12 12 0 0 0 0 10.78l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

/** "Continue with Google" plus an "or" divider above the email form. */
export function GoogleSignIn({ next, onError }: { next?: string; onError: (message: string) => void }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await signInWithGoogle(next);
          } catch (e) {
            onError(e instanceof Error ? e.message : "Something went wrong.");
            setPending(false);
          }
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <GoogleMark />}
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator" aria-label="or">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
