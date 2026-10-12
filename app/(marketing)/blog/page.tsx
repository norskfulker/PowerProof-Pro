import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { EmptyState } from "@/components/pp/empty-state";
import { getBlogPosts } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Blog" };
export const revalidate = 300;

/** Everything published, newest first. Nothing yet reads as an empty shelf, not an error. */
export default async function BlogPage() {
  const posts = await getBlogPosts();
  return (
    <>
      <section className="gutter mx-auto max-w-[1200px] pt-10 pb-8 md:pt-16">
        <p className="eyebrow">Blog</p>
        <h1 className="mt-2 max-w-2xl text-4xl sm:text-5xl">Notes on selling digital products.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">Launch stories, pricing notes and how-tos from PowerProof.</p>
      </section>
      <section className="gutter mx-auto max-w-[1200px] pb-16">
        {posts.length === 0 ? (
          <EmptyState icon={Newspaper} title="No posts yet." body="Stories from PowerProof are on their way. Check back soon." />
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-card border bg-surface transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary">
                  {p.coverSrc ? (
                    p.coverKind === "video" ? (
                      <span className="grid aspect-[16/9] w-full place-items-center bg-black text-sm text-white">▶ Video</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverSrc} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                    )
                  ) : (
                    <span aria-hidden className="grid aspect-[16/9] w-full place-items-center bg-primary-soft font-display text-4xl text-primary">{p.title.slice(0, 1)}</span>
                  )}
                  <span className="flex flex-1 flex-col gap-2 p-5">
                    <span className="text-xs text-muted-foreground">{formatDate(p.publishedAt ?? p.createdAt)} · {p.author}</span>
                    <span className="font-display text-xl leading-snug group-hover:underline">{p.title}</span>
                    {p.excerpt && <span className="text-sm text-muted-foreground">{p.excerpt}</span>}
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary">
                      Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <CtaBand />
    </>
  );
}
