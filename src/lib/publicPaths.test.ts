import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { isPublicPath, requiresSession } from "./publicPaths";

// Regression guard for a bug that has shipped four times: a new folder is
// added under public/, but not to PUBLIC_PATHS, so the auth middleware
// 302s every file in it to /login. It is invisible to whoever is testing,
// because they are logged in; only logged-out visitors see the breakage.
// The 1 Oct 2026 occurrence (public/screenshots/) put four broken images
// on the homepage while outreach emails were pointing schools at it.

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

// Folders under public/ that are deliberately NOT reachable without a
// session. Empty on purpose: anything in public/ is served as a static
// file, so gating it in middleware is a weak control at best -- if
// something genuinely must be private, it does not belong in public/.
// Listing a folder here is a decision to document, not a default.
const INTENTIONALLY_GATED: string[] = [];

describe("isPublicPath", () => {
  it("covers every top-level folder in public/", () => {
    const folders = readdirSync(publicDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !INTENTIONALLY_GATED.includes(name));

    // Sanity check that we actually found the folders, so a bad path
    // can't make this test vacuously pass.
    expect(folders.length).toBeGreaterThan(0);

    const missing = folders.filter((name) => !isPublicPath(`/${name}/some-file.ext`));
    expect(
      missing,
      `public/${missing.join(", public/")} is served statically but not in PUBLIC_PATHS, ` +
        `so every file in it redirects to /login for logged-out visitors. ` +
        `Add "/${missing[0] ?? "folder"}" to src/lib/publicPaths.ts.`
    ).toEqual([]);
  });

  it("lets the marketing pages and their assets through", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/screenshots/fees.jpg")).toBe(true);
    expect(isPublicPath("/brand/icon-transparent.png")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/sitemap.xml")).toBe(true);
  });

  it("still requires a session for the app itself", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/dashboard/accounting")).toBe(false);
    expect(isPublicPath("/api/children")).toBe(false);
    // Platform admin screens are gated by requirePlatformAdmin, but they
    // must not be session-free either -- only /platform/join is listed.
    expect(isPublicPath("/platform/testimonials")).toBe(false);
  });

  it("lets a token-authenticated link through without a session", () => {
    // Each of these is reached by someone who is, by definition, not
    // logged in: a parent filling in a form, an invited colleague, or
    // anyone opening the verification email on a second device. The URL's
    // own token is what gets checked server-side.
    expect(isPublicPath("/apply/some-token")).toBe(true);
    expect(isPublicPath("/invite/some-token")).toBe(true);
    expect(isPublicPath("/verify-email/some-token")).toBe(true);
    expect(isPublicPath("/reset-password/some-token")).toBe(true);
  });

  it("matches on path segments, not bare string prefixes", () => {
    // "/brand" being public must not make "/brandnew" public.
    expect(isPublicPath("/brandnew")).toBe(false);
    expect(isPublicPath("/applyings")).toBe(false);
    expect(isPublicPath("/logins")).toBe(false);
    // The "/" entry must not make everything public.
    expect(isPublicPath("/children")).toBe(false);
  });
});

describe("requiresSession", () => {
  it("protects the app itself", () => {
    expect(requiresSession("/dashboard")).toBe(true);
    expect(requiresSession("/dashboard/accounting/children")).toBe(true);
    expect(requiresSession("/platform/testimonials")).toBe(true);
  });

  it("keeps API routes default-deny, so a new endpoint is protected on day one", () => {
    expect(requiresSession("/api/children")).toBe(true);
    expect(requiresSession("/api/organizations/abc/trash")).toBe(true);
    expect(requiresSession("/api/some-endpoint-nobody-has-written-yet")).toBe(true);
    // ...except the handful that are explicitly public.
    expect(requiresSession("/api/auth/callback/credentials")).toBe(false);
    expect(requiresSession("/api/cron/purge")).toBe(false);
  });

  it("lets an unknown URL reach the 404 page instead of the login page", () => {
    // The whole point of the 2 Oct 2026 change. These paths don't exist;
    // a logged-out visitor should get not-found.tsx, and a crawler should
    // get a 404 rather than "Welcome back".
    expect(requiresSession("/features")).toBe(false);
    expect(requiresSession("/contact")).toBe(false);
    expect(requiresSession("/signup")).toBe(false);
    expect(requiresSession("/blog/some-old-post")).toBe(false);
    expect(requiresSession("/asdfghjkl")).toBe(false);
  });

  it("does not ask for a session on the public pages or their assets", () => {
    expect(requiresSession("/")).toBe(false);
    expect(requiresSession("/pricing")).toBe(false);
    expect(requiresSession("/screenshots/fees.jpg")).toBe(false);
    expect(requiresSession("/verify-email/some-token")).toBe(false);
  });
});
