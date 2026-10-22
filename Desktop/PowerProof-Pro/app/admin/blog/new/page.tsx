"use client";

import { PageHeader } from "@/components/pp/page-header";
import { BlogForm, blogDateInput } from "@/components/admin/blog-form";
import { BLANK_BLOG } from "@/lib/types";

/** A new post: empty, dated now, saved as a draft until it's published. */
export default function Page() {
  return (
    <>
      <title>New post · Blog · PowerProof admin</title>
      <PageHeader back={{ href: "/admin/blog", label: "Blog" }} title="New post" />
      <BlogForm initial={{ ...BLANK_BLOG, publishedAt: blogDateInput(new Date().toISOString()) }} />
    </>
  );
}
