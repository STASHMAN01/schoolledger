// Class profiles (Dylan, 4 Oct 2026): a login for a classroom tablet that
// has no email address. An admin creates it under Settings -> Team with a
// name, a class and a password; the tablet logs in with a username like
// "dees.butterfly".
//
// The rules that keep a shared tablet safe live here so the API routes,
// requireMembership and the tests all use the same ones:
//  - at most MAX_PROFILES_PER_ORG per school
//  - always TEACHER, scoped to one class
//  - never any of PROFILE_BLOCKED_PERMISSIONS, whatever an admin ticks
import { z } from "zod";
import { schoolSlug } from "@/lib/slug";

export const MAX_PROFILES_PER_ORG = 10;

// The blocked list itself lives in permissions.ts (client-safe) so
// getEffectivePermissions can apply it everywhere permissions are worked out.
export { PROFILE_BLOCKED_PERMISSIONS, limitProfilePermissions } from "@/lib/permissions";

/** "Butterfly Class!" -> "butterfly-class" (empty if nothing usable). */
export function profileSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/**
 * Usernames to try for a new profile, best first. The short form uses
 * the school name's first word ("DEES DUCKLING CENTRE" -> "dees"); if
 * another school already took that, the full school slug is the fallback.
 */
export function candidateUsernames(schoolName: string, profileName: string): string[] {
  const slug = schoolSlug(schoolName);
  const short = slug.split("-")[0] || slug;
  const part = profileSlug(profileName);
  if (!part) return [];
  const names = [`${short}.${part}`, `${slug}.${part}`];
  return Array.from(new Set(names));
}

export { parseLoginIdentifier } from "@/lib/loginIdentifier";

export const createProfileSchema = z.object({
  name: z.string().trim().min(1, "Give the profile a name.").max(60),
  categoryId: z.string().min(1, "Choose the class this tablet is for."),
  password: z.string().min(10, "Password must be at least 10 characters.").max(200),
});

export const resetProfilePasswordSchema = z.object({
  password: z.string().min(10, "Password must be at least 10 characters.").max(200),
});
