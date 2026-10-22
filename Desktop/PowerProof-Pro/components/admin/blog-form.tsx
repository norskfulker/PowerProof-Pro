"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { BlogBody } from "@/components/blog/blog-body";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { deleteBlogPost, getBlogSlugs, saveBlogPost } from "@/lib/api";
import { excerptOf, uniqueSlug } from "@/lib/blog";
import { PAGE_SLUG } from "@/lib/pages/schema";
import { slugify } from "@/lib/slug";
import type { BlogInput, BlogStatus } from "@/lib/types";

const schema = z.object({
  title: z.string().trim().min(1, "Give the post a title.").max(160, "Keep it under 160 characters."),
  slug: z.string().trim().regex(PAGE_SLUG, "Lowercase letters, numbers and dashes only."),
  excerpt: z.string().max(300, "Keep it under 300 characters."),
  body: z.string().max(20000, "That text is too long for one post."),
  coverKind: z.enum(["image", "video"]),
  coverSrc: z.string().trim().refine((v) => v === "" || /^https:\/\//.test(v), "Paste an https link, or leave it empty."),
  coverAlt: z.string().max(200, "Keep it under 200 characters."),
  author: z.string().trim().min(1, "Name the author.").max(80),
  publishedAt: z.string(),
  status: z.enum(["draft", "published"]),
});
type Values = z.infer<typeof schema>;

/** An ISO datetime as the value a datetime-local input wants. Empty stays empty. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const fromLocalInput = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** The safe rich text as buyers see it, inside the admin preview frame. */
function RichPreview({ body }: { body: string }) {
  if (!body.trim()) return <p className="text-sm text-muted-foreground">Nothing to preview yet. Write on the left.</p>;
  return <BlogBody body={body} />;
}

/**
 * One blog post, new or existing. The slug follows the title until it's edited by hand;
 * saving a taken link suggests the next free one instead of failing silently.
 */
export function BlogForm({ initial, postId, takenTitle }: { initial: BlogInput; /** Editing this post (undefined for a new one) */ postId?: string; takenTitle?: string }) {
  const router = useRouter();
  const slugs = useApi(getBlogSlugs, []);
  const [slugTouched, setSlugTouched] = useState(!!initial.slug && initial.slug !== slugify(initial.title));
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { ...initial, coverKind: initial.coverKind, status: initial.status } });
  const title = useWatch({ control: form.control, name: "title" });
  const slug = useWatch({ control: form.control, name: "slug" });
  const body = useWatch({ control: form.control, name: "body" });
  const coverKind = useWatch({ control: form.control, name: "coverKind" });
  const coverSrc = useWatch({ control: form.control, name: "coverSrc" });
  const taken = (slugs.data ?? []).filter((s) => s !== takenTitle);

  const proposeSlug = () => {
    const next = uniqueSlug(title || "post", taken);
    form.setValue("slug", next, { shouldValidate: true });
    setSlugTouched(true);
  };

  async function onSubmit(v: Values) {
    let link = v.slug.trim();
    if (taken.includes(link)) {
      if (!slugTouched) {
        link = uniqueSlug(v.title, taken);
        form.setValue("slug", link);
        toast("Link taken, used the next free one", { description: `/blog/${link}` });
      } else {
        form.setError("slug", { message: `That link is taken. Try ${uniqueSlug(v.title, taken)}.` });
        return;
      }
    }
    const at = fromLocalInput(v.publishedAt) ?? (v.status === "published" ? new Date().toISOString() : null);
    try {
      await saveBlogPost({
        id: postId,
        title: v.title.trim(),
        slug: link,
        excerpt: v.excerpt.trim() || excerptOf(v.body),
        body: v.body,
        coverSrc: v.coverSrc.trim(),
        coverKind: v.coverKind,
        coverAlt: v.coverAlt.trim(),
        status: v.status as BlogStatus,
        author: v.author.trim() || "PowerProof",
        publishedAt: at,
      });
      toast.success(postId ? "Post saved" : v.status === "published" ? "Post published" : "Draft saved", { description: v.title });
      if (!postId) router.push("/admin/blog");
      else router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save it.");
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-24">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    autoFocus={!postId}
                    maxLength={160}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      if (!slugTouched) form.setValue("slug", slugify(e.target.value), { shouldValidate: form.formState.isSubmitted });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link</FormLabel>
                <div className="flex flex-wrap items-start gap-2">
                  <FormControl>
                    <div className="flex min-w-0 flex-1 items-center gap-0">
                      <span className="shrink-0 rounded-l-control border border-r-0 border-input bg-surface-sunken px-3 font-mono text-sm text-muted-foreground max-sm:hidden">/blog/</span>
                      <Input
                        className="rounded-l-none font-mono max-sm:rounded-l-control"
                        maxLength={60}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setSlugTouched(true);
                        }}
                      />
                    </div>
                  </FormControl>
                  <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={proposeSlug} aria-label="Make the link from the title">
                    <RefreshCw aria-hidden /> Remake
                  </Button>
                </div>
                <FormDescription>{slug ? `Buyers read it at /blog/${slug}.` : "Follows the title until you edit it."}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="excerpt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Short line <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Textarea rows={2} maxLength={300} placeholder="One line for the card and search results. Empty uses the start of the text." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium" aria-hidden>Text</span>
              <Segmented label="Write or preview" value={preview ? "preview" : "write"} onChange={(v) => setPreview(v === "preview")} options={[{ value: "write", label: "Write" }, { value: "preview", label: "Preview" }]} />
            </div>
            {preview ? (
              <div className="min-h-48 rounded-control border bg-surface p-4"><RichPreview body={body} /></div>
            ) : (
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Text</FormLabel>
                    <FormControl><Textarea rows={14} maxLength={20000} placeholder={"Write the post. A blank line starts a new paragraph.\n\n**bold**, _italic_ and [links](https://…) work. No HTML."} {...field} size="lg" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <fieldset className="flex flex-col gap-4 rounded-card border p-4">
            <legend className="px-1 text-sm font-medium">Cover (optional)</legend>
            <FormField
              control={form.control}
              name="coverKind"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Segmented label="Cover type" value={field.value} onChange={field.onChange} options={[{ value: "image", label: "Photo" }, { value: "video", label: "Video" }]} className="self-start" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverSrc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{coverKind === "video" ? "Video link" : "Photo link"}</FormLabel>
                  <FormControl><Input inputMode="url" placeholder="https://" maxLength={1000} {...field} /></FormControl>
                  <FormDescription>Paste an https photo or video link.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverAlt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Describe it <span className="font-normal text-muted-foreground">(for screen readers)</span></FormLabel>
                  <FormControl><Input maxLength={200} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/^https:\/\//.test(coverSrc) && (
              coverKind === "video"
                ? <video src={coverSrc} controls preload="metadata" playsInline className="max-h-64 w-full rounded-control bg-black object-contain" aria-label={form.getValues("coverAlt") || "Cover video"} />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={coverSrc} alt="" className="max-h-64 w-full rounded-control bg-muted object-cover" />
            )}
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="author"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Author</FormLabel>
                  <FormControl><Input maxLength={80} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="publishedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date readers see</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormDescription>Empty uses {postId ? "the saved date" : "now when it goes live"}.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Segmented label="Visibility" value={field.value} onChange={field.onChange} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} className="self-start" />
                </FormControl>
                <FormDescription>{field.value === "published" ? "Buyers can read it at /blog as soon as you save." : "Only staff see drafts."}</FormDescription>
              </FormItem>
            )}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              {postId ? "Save changes" : "Create post"}
            </Button>
            {postId && (
              <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden /> Delete
              </Button>
            )}
          </div>
        </form>
      </Form>
      {postId && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this post?"
          description="It's gone from /blog for good. This can't be undone."
          confirmLabel="Delete post"
          onConfirm={async () => {
            try {
              await deleteBlogPost(postId);
              toast.success("Post deleted");
              router.push("/admin/blog");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't delete it.");
              throw e;
            }
          }}
        />
      )}
    </>
  );
}

/** The date a saved post shows in the form's date picker. */
export function blogDateInput(publishedAt?: string, createdAt?: string): string {
  return toLocalInput(publishedAt ?? createdAt ?? "");
}
