// Which paths the auth middleware lets through without a session.
//
// This lives in its own module (rather than inside src/middleware.ts) so it
// can be unit-tested without booting NextAuth — see publicPaths.test.ts,
// which asserts that every top-level folder in public/ is covered here.
//
// IMPORTANT: the middleware matcher runs on *everything* except
// _next/static, _next/image and favicon.ico. That includes static files in
// public/. So adding a folder under public/ is only half the job: if
// anything logged-out needs to fetch it, it must also be listed below, or
// it will 302 to /login. That mistake has shipped four times now (see the
// comments against individual entries), and it is invisible to whoever is
// testing while logged in.

export const PUBLIC_PATHS = [
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
  // The Android app signs in here (no session yet); the route rate-limits.
  "/api/mobile/login",
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
  // Installable-app files (manifest, service worker, offline screen). A
  // phone fetching these has no session -- and the browser decides
  // whether to offer "Install app" from them. Single files in public/ are
  // NOT covered by the folder check in publicPaths.test.ts, so each one is
  // listed here and checked by name there.
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  // Digital Asset Links (public/.well-known/assetlinks.json): Android
  // fetches this, signed-out, to confirm the installed app really belongs
  // to this site. Without it the app shows a browser address bar.
  "/.well-known",
  // Marketing screenshots used by the homepage's "What it actually looks
  // like" section (public/screenshots/*.jpg). Same class of bug as the
  // robots.txt/sitemap.xml one above: added the folder on 1 Oct 2026 but
  // not this entry, so every screenshot 302'd to /login and the homepage
  // rendered four broken images for logged-out visitors (the only kind
  // that sees the homepage). Caught by Dylan the same day.
  "/screenshots",
  // The blank children-import spreadsheet offered on the import screen
  // (public/templates/). Only linked from behind the login today, so it
  // was never actually broken — listed here because it is a static file
  // in public/ with nothing sensitive in it, and leaving it off the list
  // meant the next public link to it would break exactly like
  // /screenshots did.
  "/templates",
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
  // The email-verification link. Like /invite and /apply above, the token
  // in the URL is what's checked (src/app/api/auth/verify-email), and the
  // page itself reads no session at all. It was missing from this list,
  // so anyone who opened the verification email anywhere they weren't
  // already signed in -- a phone, another browser -- landed on /login
  // instead of verifying. The API route was reachable the whole time
  // (it sits under the public /api/auth); only the page was blocked.
  "/verify-email",
];

// Areas that genuinely require a session. Everything outside these is
// either public (above) or simply doesn't exist.
//
// This distinction is why it matters: the middleware used to treat
// "not public" as "send them to /login", which meant every typo'd URL and
// every stale inbound link showed a logged-out visitor the login page
// instead of a 404, and search engines crawling a dead link were served
// "Welcome back". Listing the protected areas instead lets an unknown
// path fall through to src/app/not-found.tsx.
//
// This is not the only thing guarding these areas -- src/app/dashboard
// and src/app/platform each check the session in their own layout and
// redirect, and every API route checks membership for itself. The
// middleware is the outer layer, not the only one.
export const PROTECTED_PREFIXES = ["/dashboard", "/platform"];

/**
 * Whether a request must carry a session to proceed.
 *
 * API routes stay default-deny: anything under /api that isn't explicitly
 * public needs a session, so a new private endpoint is protected the
 * moment it exists. Page routes are deny-by-area, so that unknown URLs
 * can 404 properly.
 */
export function requiresSession(pathname: string) {
  if (isPublicPath(pathname)) return false;
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Matches a listed path exactly, or anything beneath it. The `p + "/"`
// (rather than a bare prefix test) is deliberate: it keeps "/brandnew"
// from being treated as public just because "/brand" is listed.
export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
