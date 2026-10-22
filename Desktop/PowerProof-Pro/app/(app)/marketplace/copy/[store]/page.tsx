"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { copySiteFrom, type SiteCopyResult } from "@/lib/api";

/**
 * Marketplace › Copy this site. Opening the link is the whole action: the other store's site is
 * copied into yours and put live straight away (lib/api copySiteFrom), with your old home page
 * kept as a version. Shareable: anyone signed in who opens it gets their own copy.
 */
export default function CopySitePage() {
  const { store } = useParams<{ store: string }>();
  const [state, setState] = useState<{ done?: SiteCopyResult; error?: string }>({});
  // Strict mode runs effects twice in development: copy once
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    copySiteFrom(decodeURIComponent(store))
      .then((done) => setState({ done }))
      .catch((e) => setState({ error: e instanceof Error ? e.message : "Couldn't copy that site." }));
  }, [store]);

  const { done, error } = state;
  return (
    <>
      <PageHeader back={{ href: "/marketplace", label: "Marketplace" }} title="Copy this site" />
      {error ? (
        <ErrorState title="Couldn't copy this site" message={error} />
      ) : done ? (
        <EmptyState
          icon={CheckCircle2}
          title="Your store is live with the copied site."
          body={`The look, the home page${done.pages ? ` and ${done.pages} more page${done.pages === 1 ? "" : "s"}` : ""} are now yours, showing your own products.${done.skipped ? ` ${done.skipped} page${done.skipped === 1 ? "" : "s"} didn't fit your plan.` : ""} Your old home page is saved under Versions in the theme editor.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <a href={`/s/${done.storeSlug}`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> View your live store</a>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/store/${done.storeId}/design/pages/home/edit`}>Edit in the theme editor</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <EmptyState icon={Loader2} title="Copying the site and putting it live…" body="This takes a few seconds. Keep this page open." />
      )}
    </>
  );
}
