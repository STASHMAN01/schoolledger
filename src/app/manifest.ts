import type { MetadataRoute } from "next";

// Makes the real Crechely site installable on phones and tablets (Chrome ->
// "Install app" / "Add to Home screen"). The installed app is not a
// separate copy: it opens this same site, so a change deployed to the web
// is the change on every installed device, with nothing to rebuild.
//
// - start_url is /dashboard: a signed-in person lands on their dashboard,
//   and anyone who isn't is sent to the login screen by the middleware,
//   rather than seeing the marketing homepage inside an app.
// - scope "/" keeps every page of the site inside the installed app.
// - Served at /manifest.webmanifest, which must be in PUBLIC_PATHS
//   (src/lib/publicPaths.ts) or logged-out devices can't install.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Crechely",
    short_name: "Crechely",
    description: "Centre management and fees for preschools and crèches.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fafaf9",
    theme_color: "#0670b8",
    categories: ["education", "business"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
