import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Did not exist before this pass (CRECHELY_AUDIT.md C6/M8). Only public,
// indexable marketing pages are listed — dashboard/platform routes are
// behind auth and excluded via robots.ts instead.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/pricing", "/support", "/register", "/login", "/privacy", "/terms", "/popia"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route === "/pricing" ? 0.9 : 0.5,
  }));
}
