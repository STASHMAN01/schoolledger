// Imported by src/lib/auth.ts, which also runs inside the Edge middleware.
// Keep this file free of imports: anything Node-only pulled in here (the
// mail library, Prisma, crypto) takes down EVERY page, because the
// middleware runs on every request. That happened on 4 Oct 2026, when this
// function lived in profiles.ts, which imports schoolMail -> nodemailer.

/** What the login box got: an email (has "@") or a profile username. */
export function parseLoginIdentifier(raw: unknown): { kind: "email" | "username"; value: string } | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 200) return null;
  if (value.includes("@")) return { kind: "email", value };
  if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(value)) return null;
  return { kind: "username", value };
}
