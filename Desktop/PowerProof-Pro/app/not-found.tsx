import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SystemPage } from "@/components/pp/system-page";

export default function NotFound() {
  return (
    <SystemPage
      code="404"
      title="This page wandered off."
      body="The link might have a typo, or the thing it pointed to has been moved or taken down."
      action={<Button asChild><Link href="/">Go home</Link></Button>}
    />
  );
}
