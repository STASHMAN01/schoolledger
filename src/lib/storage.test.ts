import { describe, expect, it } from "vitest";
import { buildKey, extensionFor, isAllowedUploadType, storageConfigured } from "./storage";

describe("storage keys", () => {
  it("files live under their school", () => {
    expect(buildKey("org1", "CLASSWORK", "file1", "image/jpeg")).toBe("org/org1/classwork/file1.jpg");
    expect(buildKey("org1", "REPORT", "file2", "application/pdf")).toBe("org/org1/report/file2.pdf");
  });

  it("maps content types to extensions", () => {
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("anything/else")).toBe("jpg");
  });

  it("only allows photos and PDFs", () => {
    expect(isAllowedUploadType("image/jpeg")).toBe(true);
    expect(isAllowedUploadType("video/mp4")).toBe(false);
    expect(isAllowedUploadType("text/html")).toBe(false);
  });

  it("reports itself unconfigured when the R2 variables are missing", () => {
    delete process.env.R2_ACCOUNT_ID;
    expect(storageConfigured()).toBe(false);
  });
});
