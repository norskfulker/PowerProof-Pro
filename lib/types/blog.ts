/** The platform blog: written by staff in Admin, read on the marketing site. */
export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Safe rich text (**bold**, _italic_, [links](https://…)); never HTML */
  body: string;
  coverSrc: string;
  coverKind: "image" | "video";
  coverAlt: string;
  status: BlogStatus;
  author: string;
  /** Display date; falls back to when it was written */
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogInput {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverSrc: string;
  coverKind: "image" | "video";
  coverAlt: string;
  status: BlogStatus;
  author: string;
  /** Local datetime from the form; empty keeps the old date (or now for a new post) */
  publishedAt: string;
}

export const BLANK_BLOG: BlogInput = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverSrc: "",
  coverKind: "image",
  coverAlt: "",
  status: "draft",
  author: "PowerProof",
  publishedAt: "",
};
