"use client";

import { use } from "react";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogForm, blogDateInput } from "@/components/admin/blog-form";
import { useApi } from "@/hooks/use-api";
import { getAdminBlogPosts } from "@/lib/api";
import type { BlogInput } from "@/lib/types";

/** An existing post: everything editable, including its link and date. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const post = useApi(() => getAdminBlogPosts(), [], { live: true });
  const found = post.data?.find((p) => p.id === id);

  if (post.error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <ErrorState message={post.error} onRetry={post.reload} />
      </div>
    );
  }
  if (!post.data || !found) {
    if (post.data) {
      return (
        <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
          <ErrorState message="That post isn't here. It may have been deleted." onRetry={post.reload} />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }
  const initial: BlogInput = {
    title: found.title,
    slug: found.slug,
    excerpt: found.excerpt,
    body: found.body,
    coverSrc: found.coverSrc,
    coverKind: found.coverKind,
    coverAlt: found.coverAlt,
    status: found.status,
    author: found.author,
    publishedAt: blogDateInput(found.publishedAt ?? undefined, found.createdAt),
  };
  return (
    <>
      <title>{`${found.title} · Blog · PowerProof admin`}</title>
      <PageHeader back={{ href: "/admin/blog", label: "Blog" }} title={found.title} />
      <BlogForm key={found.id + found.updatedAt} initial={initial} postId={found.id} takenTitle={found.slug} />
    </>
  );
}
