import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SystemPage } from "@/components/pp/system-page";

export const metadata: Metadata = { title: "Something broke" };

/** Static preview of the server error page (the live one is app/error.tsx). */
export default function ServerErrorPreview() {
  return (
    <SystemPage
      code="500"
      title="Something broke on our side."
      body="It's not you. Try again in a moment; if it keeps happening, mention code PP-500 to support."
      action={<Button asChild><Link href="/">Try again</Link></Button>}
    />
  );
}
