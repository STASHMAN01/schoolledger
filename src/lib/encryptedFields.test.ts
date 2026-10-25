import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import {
  DECRYPTED_RESULT_FIELDS,
  ENCRYPTED_FIELDS,
  ENCRYPTED_PREFIX,
  openValue,
  sealArgs,
  sealValue,
} from "./encryptedFields";

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encrypted fields (security review #15/#21)", () => {
  it("read and write lists match, and every field is a String column", () => {
    expect(DECRYPTED_RESULT_FIELDS).toEqual(ENCRYPTED_FIELDS);
    for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
      const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
      expect(m, model).toBeDefined();
      for (const f of fields) {
        const field = m!.fields.find((x) => x.name === f);
        expect(field?.type, `${model}.${f}`).toBe("String");
        expect(field?.isList, `${model}.${f}`).toBe(false);
      }
    }
  });

  it("seals and opens, idempotently, leaving null and empty alone", () => {
    const sealed = sealValue("8001015009087") as string;
    expect(sealed.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(sealed).not.toContain("8001015009087");
    expect(sealValue(sealed)).toBe(sealed);
    expect(openValue(sealed)).toBe("8001015009087");
    expect(openValue("old plaintext")).toBe("old plaintext");
    expect(sealValue(null)).toBeNull();
    expect(sealValue("")).toBe("");
  });

  it("seals nested writes through relations", () => {
    const args = sealArgs("Child", "create", {
      data: {
        firstName: "Test",
        childIdNumber: "1",
        guardians: { create: [{ idNumber: "2", firstName: "G" }] },
        documents: { createMany: { data: [{ fileData: "data:x", type: "ID" }] } },
      },
    }) as { data: Record<string, unknown> };
    const data = args.data as {
      firstName: string;
      childIdNumber: string;
      guardians: { create: { idNumber: string; firstName: string }[] };
      documents: { createMany: { data: { fileData: string }[] } };
    };
    expect(data.firstName).toBe("Test");
    expect(openValue(data.childIdNumber)).toBe("1");
    expect(data.guardians.create[0].idNumber.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(data.guardians.create[0].firstName).toBe("G");
    expect(data.documents.createMany.data[0].fileData.startsWith(ENCRYPTED_PREFIX)).toBe(true);
  });

  it("seals upsert and { set } updates, ignores reads", () => {
    const up = sealArgs("Guardian", "upsert", { where: { id: "g" }, create: { idNumber: "a" }, update: { idNumber: { set: "b" } } }) as {
      create: { idNumber: string };
      update: { idNumber: { set: string } };
    };
    expect(openValue(up.create.idNumber)).toBe("a");
    expect(openValue(up.update.idNumber.set)).toBe("b");
    const where = { where: { idNumber: "a" } };
    expect(sealArgs("Guardian", "findFirst", where)).toBe(where);
  });
});
