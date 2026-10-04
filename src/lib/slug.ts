// No imports on purpose, so anything can use it (see loginIdentifier.ts).

/** "Sunny Smiles Pre-School (Pty) Ltd" -> "sunny-smiles-pre-school-pty-ltd" (never empty). */
export function schoolSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "school";
}
