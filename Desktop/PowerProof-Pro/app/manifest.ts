import type { MetadataRoute } from "next";

/** The installable app shell (name, colours, icon). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PowerProof — sell digital products in minutes",
    short_name: "PowerProof",
    description: "Add a product, share a link, get paid.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F6F4",
    theme_color: "#0F3D33",
    icons: [{ src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
  };
}
