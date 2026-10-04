import { describe, expect, it } from "vitest";
import {
  PROFILE_BLOCKED_PERMISSIONS,
  candidateUsernames,
  createProfileSchema,
  parseLoginIdentifier,
  profileSlug,
} from "@/lib/profiles";
import { ALL_PERMISSIONS, getEffectivePermissions } from "@/lib/permissions";

describe("parseLoginIdentifier", () => {
  it("treats anything with @ as an email, lowercased and trimmed", () => {
    expect(parseLoginIdentifier("  Owner@Example.com ")).toEqual({
      kind: "email",
      value: "owner@example.com",
    });
  });

  it("treats school.profile as a username", () => {
    expect(parseLoginIdentifier("Dees.Butterfly")).toEqual({
      kind: "username",
      value: "dees.butterfly",
    });
  });

  it("rejects anything that is neither", () => {
    expect(parseLoginIdentifier("butterfly")).toBeNull();
    expect(parseLoginIdentifier("dees.butter fly")).toBeNull();
    expect(parseLoginIdentifier("a.b.c")).toBeNull();
    expect(parseLoginIdentifier("")).toBeNull();
    expect(parseLoginIdentifier(undefined)).toBeNull();
    expect(parseLoginIdentifier(42)).toBeNull();
  });
});

describe("candidateUsernames", () => {
  it("uses the school's first word first, the full school slug as a fallback", () => {
    expect(candidateUsernames("DEES DUCKLING CENTRE", "Butterfly")).toEqual([
      "dees.butterfly",
      "dees-duckling-centre.butterfly",
    ]);
  });

  it("does not repeat itself for a one-word school", () => {
    expect(candidateUsernames("Sunflower", "Fish Class")).toEqual(["sunflower.fish-class"]);
  });

  it("gives nothing when the profile name has no usable characters", () => {
    expect(candidateUsernames("Sunflower", "!!!")).toEqual([]);
  });

  it("always produces usernames the login box accepts", () => {
    for (const u of candidateUsernames("Crèche Één (Pty) Ltd", "Dragon-Fly 2")) {
      expect(parseLoginIdentifier(u)?.kind).toBe("username");
    }
  });
});

describe("profileSlug", () => {
  it("strips accents and punctuation", () => {
    expect(profileSlug("  Crème Brûlée!  ")).toBe("creme-brulee");
  });
});

describe("createProfileSchema", () => {
  it("requires a 10+ character password", () => {
    expect(
      createProfileSchema.safeParse({ name: "Fish", categoryId: "c1", password: "short" }).success
    ).toBe(false);
    expect(
      createProfileSchema.safeParse({ name: "Fish", categoryId: "c1", password: "long-enough-1" })
        .success
    ).toBe(true);
  });
});

describe("profile permissions", () => {
  it("never include a blocked permission, even when an override grants it", () => {
    const everything = ALL_PERMISSIONS.map((permission) => ({ permission, granted: true }));
    const perms = getEffectivePermissions("TEACHER", everything, { isProfile: true });
    for (const blocked of PROFILE_BLOCKED_PERMISSIONS) {
      expect(perms).not.toContain(blocked);
    }
    expect(perms).toContain("MANAGE_ATTENDANCE");
    expect(perms).toContain("MANAGE_CHILDREN");
    expect(perms).toContain("VIEW_CENTRE");
  });

  it("give a profile nothing if it somehow holds a role other than Teacher", () => {
    expect(getEffectivePermissions("ADMIN", [], { isProfile: true })).toEqual([]);
    expect(getEffectivePermissions("RECEPTIONIST", [], { isProfile: true })).toEqual([]);
  });

  it("leave normal accounts unchanged", () => {
    expect(getEffectivePermissions("ADMIN", [])).toEqual(ALL_PERMISSIONS);
    expect(getEffectivePermissions("TEACHER", [])).toContain("VIEW_ACTIVITY_LOG");
  });
});
