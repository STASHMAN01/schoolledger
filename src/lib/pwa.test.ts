import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { isPublicPath, requiresSession } from "./publicPaths";

// The installable-app files are fetched by a phone that is not signed in
// (and by the browser deciding whether to offer "Install app"). Missing
// from PUBLIC_PATHS, they'd 302 to /login and the app would silently not
// be installable -- the same trap as /screenshots and /apply before it.
// publicPaths.test.ts only checks folders under public/, so single files
// are checked here by name.

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

describe("installable app files", () => {
  it("are reachable without a session", () => {
    for (const p of ["/manifest.webmanifest", "/sw.js", "/offline.html"]) {
      expect(isPublicPath(p), p).toBe(true);
      expect(requiresSession(p), p).toBe(false);
    }
  });

  it("has a manifest that opens the real app", () => {
    const m = manifest();
    expect(m.start_url).toBe("/dashboard");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.name).toBe("Crechely");
  });

  it("has every manifest icon on disk and public, including a maskable one", () => {
    const m = manifest();
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
    expect(icons.some((i) => i.purpose === "any" && i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.purpose === "any" && i.sizes === "512x512")).toBe(true);
    for (const icon of icons) {
      expect(existsSync(path.join(publicDir, icon.src)), icon.src).toBe(true);
      expect(isPublicPath(icon.src), icon.src).toBe(true);
    }
  });

  it("only precaches public files that exist", () => {
    const sw = readFileSync(path.join(publicDir, "sw.js"), "utf8");
    const match = /const PRECACHE = \[([^\]]*)\]/.exec(sw);
    expect(match).not.toBeNull();
    const entries = [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(existsSync(path.join(publicDir, entry)), entry).toBe(true);
      expect(isPublicPath(entry), entry).toBe(true);
    }
  });

  it("never stores app pages or data from a signed-in session", () => {
    const sw = readFileSync(path.join(publicDir, "sw.js"), "utf8");
    // The only thing it may ever put in a cache is the precache list.
    expect(sw).not.toMatch(/cache\.put\(/);
    expect(sw).not.toMatch(/\.add\(/);
    // It must leave everything except page navigations alone.
    expect(sw).toMatch(/mode !== "navigate"\) return;/);
  });
});
