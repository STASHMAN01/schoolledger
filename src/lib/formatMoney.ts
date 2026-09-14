// Client-safe money formatter. Uses Intl.NumberFormat with the org's own
// currencyCode (ZAR, USD, GBP, ...) so the app reads correctly regardless
// of which country a school is in, instead of hardcoding a "R" prefix —
// important for a product explicitly meant to work globally, not just for
// South African schools. currencyCode defaults to ZAR only for the rare
// caller that genuinely doesn't have org context available; every page
// under /dashboard should pass useOrg().currencyCode instead of relying
// on that default.
export function formatCents(cents: number, currencyCode = "ZAR") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).format(cents / 100);
  } catch {
    // An unrecognized/invalid currency code should never crash a page —
    // fall back to a plain numeric amount with the raw code as a prefix.
    return `${currencyCode} ${(cents / 100).toFixed(2)}`;
  }
}
