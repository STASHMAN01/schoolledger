import { describe, expect, it } from "vitest";
import {
  DEFAULT_REQUIRED_DOCUMENTS,
  decodeDataUrl,
  documentFileSchema,
  missingDocuments,
  normaliseRequired,
} from "./documents";

const mom = { id: "g1", firstName: "Palesa", lastName: "Mokoena" };
const dad = { id: "g2", firstName: "Thabo", lastName: "Mokoena" };

describe("missingDocuments", () => {
  it("lists every default document when nothing is on file", () => {
    const m = missingDocuments([mom, dad], [], DEFAULT_REQUIRED_DOCUMENTS);
    expect(m.map((x) => x.label)).toEqual([
      "Birth certificate",
      "Clinic card",
      "Parent/guardian ID (Palesa Mokoena)",
      "Parent/guardian ID (Thabo Mokoena)",
    ]);
  });

  it("counts a parent's ID only for that parent", () => {
    const m = missingDocuments(
      [mom, dad],
      [
        { type: "BIRTH_CERTIFICATE", guardianId: null },
        { type: "CLINIC_CARD", guardianId: null },
        { type: "GUARDIAN_ID", guardianId: "g1" },
      ],
      DEFAULT_REQUIRED_DOCUMENTS
    );
    expect(m).toEqual([
      { type: "GUARDIAN_ID", label: "Parent/guardian ID (Thabo Mokoena)", guardianId: "g2", guardianName: "Thabo Mokoena" },
    ]);
  });

  it("still asks for one parent ID when no guardians are on file", () => {
    expect(missingDocuments([], [], ["GUARDIAN_ID"]).map((x) => x.label)).toEqual(["Parent/guardian ID"]);
    expect(missingDocuments([], [{ type: "GUARDIAN_ID", guardianId: null }], ["GUARDIAN_ID"])).toEqual([]);
  });

  it("only checks what the school requires", () => {
    expect(missingDocuments([mom], [], [])).toEqual([]);
    expect(missingDocuments([mom], [], ["PROOF_OF_ADDRESS"]).map((x) => x.type)).toEqual(["PROOF_OF_ADDRESS"]);
  });
});

describe("normaliseRequired", () => {
  it("drops unknown types and keeps catalogue order", () => {
    expect(normaliseRequired(["GUARDIAN_ID", "NOPE", "BIRTH_CERTIFICATE", "GUARDIAN_ID"])).toEqual([
      "BIRTH_CERTIFICATE",
      "GUARDIAN_ID",
    ]);
  });
});

describe("document files", () => {
  it("accepts photos and PDFs only", () => {
    expect(documentFileSchema.safeParse("data:image/jpeg;base64,AAAA").success).toBe(true);
    expect(documentFileSchema.safeParse("data:application/pdf;base64,JVBERi0=").success).toBe(true);
    expect(documentFileSchema.safeParse("data:text/html;base64,PGI+").success).toBe(false);
  });

  it("decodes a data URL", () => {
    const d = decodeDataUrl("data:application/pdf;base64,JVBERi0=");
    expect(d?.contentType).toBe("application/pdf");
    expect(d?.bytes.toString()).toBe("%PDF-");
  });
});
