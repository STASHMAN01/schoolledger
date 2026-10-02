import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { isPublicPath, requiresSession } from "./publicPaths";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
const file = path.join(publicDir, ".well-known/assetlinks.json");

describe("Android Digital Asset Links", () => {
  it("is reachable without a session", () => {
    expect(isPublicPath("/.well-known/assetlinks.json")).toBe(true);
    expect(requiresSession("/.well-known/assetlinks.json")).toBe(false);
  });

  // Only checked once the file exists (it is added after the Android app
  // has been signed -- see docs/ANDROID_APP.md).
  it.skipIf(!existsSync(file))("is well-formed", () => {
    const links = JSON.parse(readFileSync(file, "utf8"));
    expect(Array.isArray(links)).toBe(true);
    for (const link of links) {
      expect(link.relation).toContain("delegate_permission/common.handle_all_urls");
      expect(link.target.namespace).toBe("android_app");
      expect(link.target.package_name).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
      expect(link.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
      for (const f of link.target.sha256_cert_fingerprints) {
        expect(f).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
      }
    }
  });
});
