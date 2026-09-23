import { describe, expect, it } from "vitest";
import {
  PASSWORD_ALPHABET,
  PASSWORD_LENGTH,
  backupFilename,
  childFolderName,
  decodeDataUrl,
  formTypeLabel,
  generateBackupPassword,
  sanitizeFilePart,
} from "./helpers";

describe("backup helpers", () => {
  it("generates passwords of the right length from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateBackupPassword();
      expect(pw).toHaveLength(PASSWORD_LENGTH);
      for (const ch of pw) expect(PASSWORD_ALPHABET).toContain(ch);
    }
    expect(PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it("sanitises filename parts like statement filenames", () => {
    expect(sanitizeFilePart("Zoë O'Test")).toBe("Zoe-O-Test");
    expect(sanitizeFilePart("  --Äb c!! ")).toBe("Ab-c");
    expect(sanitizeFilePart(null)).toBe("");
  });

  it("builds child folders and backup filenames", () => {
    expect(childFolderName({ id: "cmabc123xyz999", firstName: "Test", lastName: "Chîld" })).toBe(
      "Child-Test-xyz999"
    );
    expect(backupFilename("Sunny Days Crèche", new Date("2026-09-22T10:00:00Z"))).toBe(
      "crechely-backup-sunny-days-creche-2026-09-22.zip"
    );
  });

  it("decodes data URLs and rejects malformed ones", () => {
    const ok = decodeDataUrl("data:image/png;base64,aGVsbG8=");
    expect(ok?.ext).toBe("png");
    expect(ok?.bytes.toString()).toBe("hello");
    expect(decodeDataUrl("data:application/pdf;base64,aGVsbG8=")?.ext).toBe("pdf");
    expect(decodeDataUrl("data:foo/bar;base64,aGVsbG8=")?.ext).toBe("bin");
    expect(decodeDataUrl("not a data url")).toBeNull();
    expect(decodeDataUrl("data:image/png;base64,***")).toBeNull();
    expect(decodeDataUrl(null)).toBeNull();
  });

  it("labels form types", () => {
    expect(formTypeLabel("MEDICAL_ALLERGY")).toBe("Medical-Allergy");
  });
});
