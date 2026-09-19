import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/support",
  "/privacy",
  "/terms",
  "/popia",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/webhooks",
  // SEO/crawler files and Next's own generated icon/OG routes must be
  // reachable without a session — before this fix they, and literally
  // any mistyped URL, silently redirected to /login instead of 404ing.
  // Verified live: crechely.co.za/robots.txt and /sitemap.xml both
  // redirected to /login (see CRECHELY_AUDIT.md, finding beyond-brief-1).
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/opengraph-image.png",
  "/twitter-image.png",
  "/brand",
  // Public "give a testimonial" submission form and its API route — no
  // login required to submit; moderation happens separately at
  // /platform/testimonials, which is NOT in this list (platform routes
  // are gated by requirePlatformAdmin, not by session presence alone).
  "/testimonials/new",
  "/api/testimonials",
  // Invite links must work for someone who has never logged in — the
  // invite token itself is what's checked for authenticity server-side
  // (see src/app/api/invites/*), not a session.
  "/invite",
  "/api/invites",
  // Platform-admin invite links must work the same way, for the same
  // reason — the token itself is what's checked, not a session.
  "/platform/join",
  "/api/platform/join",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default auth((req: NextRequest & { auth?: unknown }) => {
  const { pathname } = req.nextUrl;

  const response = isPublicPath(pathname)
    ? NextResponse.next()
    : req.auth
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", req.url));

  // Baseline security headers on every response. HSTS only makes sense once
  // this is actually served over HTTPS (true on Vercel/most hosts by
  // default) — do not enable it while still testing over plain HTTP.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
});

export const config = {
  // Run on everything except static assets/Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
