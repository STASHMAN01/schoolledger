// Set by src/middleware.ts on every request (overwriting any value the
// client sent) so server code without the Request object -- notably
// requireMembership in src/lib/tenant.ts -- can tell a read (GET/HEAD) from
// a write. Used to keep lapsed schools read-only rather than locked out.
export const REQUEST_METHOD_HEADER = "x-crechely-request-method";

// Same idea for the path (Dylan, 4 Oct 2026): requireMembership checks a
// Teacher's API calls against an allowlist (src/lib/teacherAccess.ts).
// Set by middleware from the real URL, replacing anything the client sent.
export const REQUEST_PATH_HEADER = "x-crechely-request-path";
