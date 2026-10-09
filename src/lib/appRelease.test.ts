import { describe, expect, it } from "vitest";
import { apkKey, checkNewVersionCode, isUpdateAvailable, releaseSchema } from "./appRelease";

describe("app releases", () => {
  it("only offers an update when the latest is newer than what's installed", () => {
    expect(isUpdateAvailable({ versionCode: 3 }, 2)).toBe(true);
    expect(isUpdateAvailable({ versionCode: 3 }, 3)).toBe(false);
    expect(isUpdateAvailable({ versionCode: 3 }, 4)).toBe(false);
    expect(isUpdateAvailable(null, 1)).toBe(false);
    expect(isUpdateAvailable({ versionCode: 3 }, Number.NaN)).toBe(false);
  });
  it("refuses an upload that isn't a higher version code", () => {
    expect(checkNewVersionCode({ versionCode: 3 }, 3)).toMatch(/higher/);
    expect(checkNewVersionCode({ versionCode: 3 }, 2)).toMatch(/higher/);
    expect(checkNewVersionCode({ versionCode: 3 }, 4)).toBeNull();
    expect(checkNewVersionCode(null, 1)).toBeNull();
  });
  it("validates the form and names the file by version", () => {
    expect(releaseSchema.parse({ versionCode: "2", versionName: " 1.1.0 " })).toMatchObject({ versionCode: 2, versionName: "1.1.0" });
    expect(releaseSchema.safeParse({ versionCode: 0, versionName: "x" }).success).toBe(false);
    expect(releaseSchema.safeParse({ versionCode: 2, versionName: "" }).success).toBe(false);
    expect(apkKey(7)).toBe("app/crechely-7.apk");
  });
});
