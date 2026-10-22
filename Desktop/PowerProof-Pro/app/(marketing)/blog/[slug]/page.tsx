import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BlogBody } from "@/components/blog/blog-body";
import { CtaBand } from "@/components/marketing/cta-band";
import { getBlogPost } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const post = await getBlogPost((await params).slug);
    const url = `${siteUrl()}/blog/${post.slug}`;
    const description = (post.excerpt || post.body.slice(0, 160)).slice(0, 160);
    const image = post.coverKind === "image" && post.coverSrc ? post.coverSrc : undefined;
    return {
      title: post.title,
      description,
      alternates: { canonical: url },
      openGraph: { type: "article", siteName: "PowerProof", title: post.title, description, url, publishedTime: post.publishedAt, authors: [post.author], images: image ? [{ url: image }] : undefined },
      twitter: { card: image ? "summary_large_image" : "summary", title: post.title, description, images: image ? [image] : undefined },
    };
  } catch {
    return { title: "Post" };
  }
}

/** One post: cover, words, author, and the way back to the rest. Drafts never reach here. */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  let post;
  try {
    post = await getBlogPost((await params).slug);
  } catch {
    notFound();
  }
  return (
    <>
      <article className="gutter mx-auto max-w-[46rem] pt-10 pb-16 md:pt-14">
        <Link href="/blog" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> All posts
        </Link>
        <h1 className="mt-4 text-4xl sm:text-5xl">{post.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{formatDate(post.publishedAt ?? post.createdAt)} · {post.author}</p>
        {post.coverSrc && (
          <figure className="mt-8">
            {post.coverKind === "video" ? (
              <video src={post.coverSrc} controls preload="metadata" playsInline className="max-h-[28rem] w-full rounded-card bg-black object-contain" aria-label={post.coverAlt || post.title} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.coverSrc} alt={post.coverAlt} className="max-h-[28rem] w-full rounded-card bg-muted object-cover" />
            )}
            {post.coverAlt && <figcaption className="mt-2 text-sm text-muted-foreground">{post.coverAlt}</figcaption>}
          </figure>
        )}
        <div className="mt-8">
          <BlogBody body={post.body} />
        </div>
      </article>
      <CtaBand />
    </>
  );
}
