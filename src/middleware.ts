import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { REQUEST_METHOD_HEADER } from "@/lib/requestMethod";

const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/support",
  "/privacy",
  "/terms",
  "/popia",
  "/refund-policy",
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
  // Marketing screenshots used by the homepage's "What it actually looks
  // like" section (public/screenshots/*.jpg). Same class of bug as the
  // robots.txt/sitemap.xml one above: added the folder on 1 Oct 2026 but
  // not this entry, so every screenshot 302'd to /login and the homepage
  // rendered four broken images for logged-out visitors (the only kind
  // that sees the homepage). Caught by Dylan the same day.
  "/screenshots",
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
  // Parent online form (Phase 2 Session 4). Parents have no account --
  // the one-time token in the link is what's checked server-side, not a
  // session. Missing from this list sent parents to /login (found by Dylan
  // 23 Sept; it only "worked" in testing because the tester was logged in).
  "/apply",
  "/api/apply",
  // Vercel Cron (e.g. the daily purge of deleted schools). No session --
  // each cron route checks the CRON_SECRET bearer token itself.
  "/api/cron",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default auth((req: NextRequest & { auth?: unknown }) => {
  const { pathname } = req.nextUrl;

  // Pass the real HTTP method through to route handlers (see
  // src/lib/requestMethod.ts). .set() replaces any client-supplied value,
  // so it can't be spoofed to sneak a write past the read-only check.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_METHOD_HEADER, req.method);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  const response = isPublicPath(pathname)
    ? next()
    : req.auth
      ? next()
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
