// Client-safe formatter (no currency-code awareness yet — the org's
// currencyCode is used server-side for the PDF statement; wiring it into
// every UI surface too is a small follow-up once multi-currency schools
// are actually in play).
export function formatCents(cents: number) {
  return `R${(cents / 100).toFixed(2)}`;
}
