// South African numbers are usually typed as 082 123 4567 or 27821234567,
// but the app stores international format (+27821234567). Converts those
// two local shapes and strips spaces/dashes/brackets; anything else is
// returned cleaned but otherwise unchanged, for the schema to validate.
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const s = value.replace(/[\s\-().]/g, "");
  if (!s) return undefined;
  if (/^0\d{9}$/.test(s)) return `+27${s.slice(1)}`;
  if (/^27\d{9}$/.test(s)) return `+${s}`;
  return s;
}

// "M", "male", "boy" -> MALE, etc. Blank -> undefined. Unknown text is
// returned as-is so the schema reports it.
export function normalizeGender(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const s = value.trim().toLowerCase();
  if (!s) return undefined;
  if (["m", "male", "boy"].includes(s)) return "MALE";
  if (["f", "female", "girl"].includes(s)) return "FEMALE";
  if (["o", "other"].includes(s)) return "OTHER";
  return value;
}
