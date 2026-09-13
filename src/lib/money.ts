// Currency-aware money formatter for server-side text (PDF statements,
// reminder messages). Deliberately a tiny symbol lookup rather than
// Intl.NumberFormat's currency formatting — this product only needs to
// print a handful of currencies correctly for the schools actually using
// it, and a simple lookup is easy to extend without any locale surprises.
export function formatMoneyCents(cents: number, currencyCode: string) {
  const symbol =
    currencyCode === "ZAR"
      ? "R"
      : currencyCode === "USD"
        ? "$"
        : currencyCode === "GBP"
          ? "£"
          : currencyCode === "EUR"
            ? "€"
            : `${currencyCode} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
