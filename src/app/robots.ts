import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Did not exist before this pass (CRECHELY_AUDIT.md C6/M8) — and even if
// it had, the middleware would have redirected any crawler request for
// /robots.txt straight to /login (fixed separately in middleware.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/platform", "/api"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
