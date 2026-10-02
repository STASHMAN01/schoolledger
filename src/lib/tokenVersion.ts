// Decides whether a signed-in user's session token is still good, given
// the tokenVersion stored on their user row.
//
// Why this is its own function: the lookup used to sit inline in the
// NextAuth jwt callback with no error handling. When that one query threw
// (a cold or dropped connection to the free Render Postgres after the app
// had been idle), Auth.js caught the error and treated the visitor as
// signed out, so /dashboard bounced them to /login even though their
// session was fine. Dylan hit this on 2 Oct 2026 clicking "Back to app".
//
// The rule now: only a definite answer from the database ends a session
// (user gone, or tokenVersion bumped by a password change or forced
// logout). A failed lookup keeps the session; the page's own queries will
// fail loudly anyway if the database really is down, which is the honest
// error, rather than a fake "you've been logged out".

export type TokenVersionLookup = () => Promise<{ tokenVersion: number } | null>;

export async function isTokenStillValid(
  tokenVersion: unknown,
  lookup: TokenVersionLookup,
): Promise<boolean> {
  let current: { tokenVersion: number } | null;
  try {
    current = await lookup();
  } catch (err) {
    console.error("[auth] tokenVersion check failed; keeping the session", err);
    return true;
  }
  return Boolean(current) && current!.tokenVersion === tokenVersion;
}
