import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { REQUEST_METHOD_HEADER, REQUEST_PATH_HEADER } from "@/lib/requestMethod";
// The list of session-free paths lives in its own module so it can be
// unit-tested without booting NextAuth -- see src/lib/publicPaths.test.ts.
import { requiresSession } from "@/lib/publicPaths";

export default auth((req: NextRequest & { auth?: unknown }) => {
  const { pathname } = req.nextUrl;

  // Pass the real HTTP method through to route handlers (see
  // src/lib/requestMethod.ts). .set() replaces any client-supplied value,
  // so it can't be spoofed to sneak a write past the read-only check.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_METHOD_HEADER, req.method);
  // Same for the path, for the Teacher allowlist in requireMembership.
  requestHeaders.set(REQUEST_PATH_HEADER, pathname);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Note this asks "does this path need a session", not "is this path
  // public". A path that is neither public nor protected is one that
  // doesn't exist, and it should fall through to the 404 page rather than
  // be redirected to /login. See src/lib/publicPaths.ts.
  const response = !requiresSession(pathname)
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
