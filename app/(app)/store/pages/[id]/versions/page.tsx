"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { VersionList } from "@/components/page-builder/version-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getVisualPage, restoreVisualVersion } from "@/lib/api";

export default function VersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, reload } = useApi(() => getVisualPage(id), [id]);
  return (
    <>
      <title>{`Versions · ${data?.page.title ?? "Page"} · PowerProof`}</title>
      <PageHeader
        title="Versions"
        eyebrow={data?.page.title}
        back={{ href: "/store/pages", label: "Store pages" }}
        description="A version is saved every time you publish. Restoring one puts it in your draft so you can check it before publishing again."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/store/pages/${id}/edit`}>
              <Pencil aria-hidden /> Open editor
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : (
        <VersionList
          versions={data.page.versions}
          context={data.context}
          onRestore={async (versionId) => {
            await restoreVisualVersion(id, versionId);
            toast.success("Restored to your draft", { description: "Publish when you're happy with it." });
            router.push(`/store/pages/${id}/edit`);
          }}
        />
      )}
    </>
  );
}
