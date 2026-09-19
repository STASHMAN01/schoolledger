// Single source of truth for the site's canonical URL — used to build
// metadataBase, canonical tags, and sitemap/robots entries. Using
// "www" per the audit brief's own reference URL
// (https://www.crechely.co.za). CRECHELY_AUDIT.md flags that the apex
// (crechely.co.za) and www subdomain appeared to behave as separate,
// non-redirecting origins when checked live — that's a DNS/Vercel domain
// setting, not app code, so it's flagged for Dylan rather than changed
// here (see OPEN_QUESTIONS.md).
export const SITE_URL = "https://www.crechely.co.za";
export const SITE_NAME = "Crechely";
