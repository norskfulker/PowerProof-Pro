/** The site's own address, without a trailing slash. Falls back to local dev. */
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
