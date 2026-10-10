import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext's Cloudflare build. Pages here read live data on every request, so no incremental cache
 * is set up; add an R2 bucket (r2IncrementalCache) if pages start using ISR or the fetch cache.
 */
export default defineCloudflareConfig({});
