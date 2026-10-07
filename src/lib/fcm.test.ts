import { generateKeyPairSync, createVerify } from "crypto";
import { describe, expect, it } from "vitest";
import { loadServiceAccount, signServiceJwt } from "@/lib/fcm";

describe("fcm helpers", () => {
  it("reads the service account JSON and rejects junk", () => {
    expect(loadServiceAccount(undefined)).toBeNull();
    expect(loadServiceAccount("not json")).toBeNull();
    expect(loadServiceAccount(JSON.stringify({ project_id: "p" }))).toBeNull();
  });

  it("signs a verifiable RS256 token with the messaging scope", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const sa = loadServiceAccount(
      JSON.stringify({ project_id: "demo", client_email: "svc@demo.iam.gserviceaccount.com", private_key: privateKey })
    )!;
    const jwt = signServiceJwt(sa, 1_000_000);
    const [h, c, s] = jwt.split(".");
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims.scope).toContain("firebase.messaging");
    expect(claims.exp - claims.iat).toBe(3600);
  });
});
