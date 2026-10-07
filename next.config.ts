import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response (security review #19).
  poweredByHeader: false,
  // The Accounting classes page used to live at /categories (24 Sept 2026:
  // renamed to /classes now that every screen says "class"). Old bookmarks
  // and links keep working.
  // The service worker must never be served from a stale cache, or a fix
  // to it would not reach installed apps. (Browsers also cap its HTTP
  // caching at 24h, but make it explicit.)
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard/accounting/categories",
        destination: "/dashboard/accounting/classes",
        permanent: true,
      },
      {
        source: "/dashboard/accounting/categories/:path*",
        destination: "/dashboard/accounting/classes/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
