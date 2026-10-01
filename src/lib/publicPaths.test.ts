import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { isPublicPath } from "./publicPaths";

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

  it("matches on path segments, not bare string prefixes", () => {
    // "/brand" being public must not make "/brandnew" public.
    expect(isPublicPath("/brandnew")).toBe(false);
    expect(isPublicPath("/applyings")).toBe(false);
    expect(isPublicPath("/logins")).toBe(false);
    // The "/" entry must not make everything public.
    expect(isPublicPath("/children")).toBe(false);
  });
});
