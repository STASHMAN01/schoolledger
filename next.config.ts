import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Accounting classes page used to live at /categories (24 Sept 2026:
  // renamed to /classes now that every screen says "class"). Old bookmarks
  // and links keep working.
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
