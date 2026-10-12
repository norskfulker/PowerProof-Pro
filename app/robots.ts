import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Crawlers may read everything; private pages (orders, downloads, admin) need sign-in anyway. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
