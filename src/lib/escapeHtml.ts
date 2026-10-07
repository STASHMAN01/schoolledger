// Escape a value before putting it inside an HTML email (security review
// #6, 7 Oct 2026). School names, child names and user names are typed by
// people, and anyone can register a free school -- without this, a school
// called `<a href="...">Pay here</a>` would send working phishing links
// from Crechely's own domain. Use it for EVERY interpolated value in an
// `html:` string, including URLs placed in href attributes.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
