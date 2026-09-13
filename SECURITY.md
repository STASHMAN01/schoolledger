# Security notes — read before touching auth, data model, or deployment

This app stores other people's children's personal information and
payment/financial records. That's a real liability surface (data breach
notification laws, POPIA in South Africa, GDPR if any EU family's data ever
passes through, plus straightforward reputational and legal risk if a
school's financial records leak). This file is the running list of what's
been done, why, and — just as important — what is deliberately **not** done
yet and must happen before onboarding real paying customers.

## What's built in from Phase 0

- **Tenant isolation.** Every organization-owned table has an
  `organizationId` column, and `src/lib/tenant.ts`'s `requireMembership()`
  is the only sanctioned way an API route checks "does this user belong to
  this school, with what role". No route should ever trust an
  `organizationId` from a request body/query string without that check.
- **Passwords are hashed, never stored or logged in plaintext**, using
  bcrypt at cost factor 12 (`src/lib/password.ts`).
- **Sessions are short-lived (12h) JWTs**, invalidated server-side via a
  `tokenVersion` counter on the User row — bump it to force logout
  everywhere (password change, suspected compromise).
- **Rate limiting on login and registration** (`src/lib/rateLimit.ts`) to
  slow down credential stuffing / brute force. Currently in-memory —
  see "Before onboarding real customer data" below.
- **Server-side input validation on every mutation** with zod
  (`src/lib/validation.ts`) — never trust client-side form validation
  alone.
- **Security headers** set in `src/middleware.ts` (X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS in
  production).
- **Append-only audit log** (`AuditLog` model) — records who did what, so
  "who recorded this payment / viewed this statement" is answerable both
  for the product's own activity feed and for incident response.
- **Field-level encryption helper** (`src/lib/fieldCrypto.ts`, AES-256-GCM)
  for the handful of fields that are sensitive but need to be recoverable in
  plaintext (bank account number for statements) — everything else
  sensitive is either hashed (passwords) or just tenant-isolated (children's
  names/contact info).
- **No secrets in git.** `.env*` is git-ignored; `.env.example` documents
  what's needed without real values.
- **Dependencies audited clean** (`npm audit` → 0 vulnerabilities) at the
  time each phase was built — re-run `npm audit` before every deploy, not
  just once.

- **Money logic is isolated and transactional.** The allocation waterfall
  (`src/lib/billing/allocation.ts`) is a pure function with no database
  access, so it can't accidentally read stale data or partially apply —
  every route that calls it wraps the read-allocate-write sequence in a
  single Prisma transaction. Recording a payment is restricted to
  ADMIN/ACCOUNTANT server-side (MANAGER can organize children/categories
  but not move money), matching the original role design.

- **Statement PDFs never trust a client-supplied child list blindly.** The
  joint-statement feature accepts other children's ids from the browser,
  but every one of them is re-checked against the requesting user's own
  organization before anything is read — the same tenant-isolation
  principle as everywhere else, applied to a feature that combines
  multiple records into one document.

- **The Stripe webhook is signature-verified before anything else runs.**
  `/api/webhooks/stripe` is the one intentionally unauthenticated route in
  the app (no session/membership check — Stripe itself is the caller), and
  that's only safe because `stripe.webhooks.constructEvent()` rejects
  anything not signed with `STRIPE_WEBHOOK_SECRET` before any database
  write happens. Never relax this to accept unsigned requests, even
  temporarily for testing — use the Stripe CLI's `stripe listen` (which
  signs requests correctly) instead.
- **Access control has one enforcement point.** Whether an organization's
  trial/subscription is active is checked inside `requireMembership()`
  itself, so every API route gets the lockout automatically instead of it
  being something each new route has to remember to add.

- **The money and access-control logic has an automated regression net.**
  `allocateOldestFirst`/`statusForEntry` (the payment waterfall),
  `buildDrilldownTree` (dashboard aggregation), and `hasActiveAccess` (the
  paywall gate) are all pure functions with a Vitest suite (`npm test`,
  23 tests) exercising the spec's own worked examples plus edge cases —
  see item 9 below for exactly what's covered.
- **Invite tokens are hashed like passwords, not stored in the clear.**
  `src/lib/inviteToken.ts` generates a random token and stores only its
  SHA-256 hash (`Invite.tokenHash`); the raw token is returned to the admin
  exactly once, at creation, in the API response — never logged, never
  persisted anywhere else. A leaked database dump therefore hands out no
  usable invite links, mirroring how a leaked user table hands out no
  usable passwords.
- **Accepting an invite always proves control of the invited email.** No
  code path lets a request attach a Membership to an email it hasn't
  demonstrated ownership of — either an active session already
  authenticated as that exact email, or a brand-new password set in the
  same request that creates the account. An invite email that already has
  an existing account is explicitly refused a new-password path (see
  `src/app/api/invites/accept/route.ts`) specifically to close off account
  takeover via a guessed or intercepted invite link.

## Known, accepted trade-offs right now

- Next.js is pinned to `15.5.25` rather than the newly-released 16.x line,
  specifically because next-auth v5 and the wider ecosystem are still
  stabilizing against Next 16's breaking changes (middleware→proxy rename,
  React 19 requirement). Next 15's own bundled `postcss` has a couple of
  known advisories (build-time only — CSS source-map/XSS issues that apply
  to processing *untrusted* CSS at build time, which this project doesn't
  do). Re-evaluate the Next 16 move once next-auth has a stable (non-beta)
  release confirmed compatible with it.
- Rate limiting is in-memory and per-instance. Fine for an early, single
  small-region deployment; **not** fine once running more than one server
  instance (serverless platforms often do this automatically). Swap for a
  shared store (e.g. Upstash Redis) before that happens.
- No automated dependency-vulnerability scanning in CI yet (Phase 0 is
  local-only) — wire up `npm audit` or GitHub Dependabot as soon as this is
  pushed to a git host.

## Before onboarding real customer data (do not skip)

1. **TLS everywhere.** Deploy behind HTTPS only (Vercel does this by
   default) — never serve login/payment data over plain HTTP.
2. **Database:** use a managed Postgres provider with encryption at rest,
   enforce `sslmode=require` on the connection string, and create a
   dedicated least-privilege DB user for the app (not a superuser).
3. **Backups:** automated, encrypted database backups with a tested restore
   procedure — a backup you've never restored from is not a backup.
4. **Secrets:** `AUTH_SECRET` and `FIELD_ENCRYPTION_KEY` must be long random
   values generated per-environment (never reused between dev/prod), stored
   only in the hosting platform's secret manager.
5. **Legal:** a privacy policy and terms of service that accurately
   describe what's collected (children's names, parent contact info,
   payment records) and how long it's kept; check POPIA obligations
   directly since the first customers are South African schools (consider
   getting a lawyer to review before charging money for this).
   **Status: first draft exists** — `legal/PRIVACY_POLICY.md` and
   `legal/TERMS_OF_SERVICE.md`. Both are explicitly marked DRAFT, have
   `[BRACKETED PLACEHOLDER]` fields for business-specific details (legal
   entity name, contact address, retention periods, jurisdiction, refund
   policy, etc.) that still need to be decided and filled in, and — this
   is the important part — **have not been reviewed by a lawyer**. Do not
   link either document from the live product or start charging real
   customers until that review has happened. The liability-limitation
   section in particular should be drafted by counsel, not filled in from
   a template.
6. **Least-privilege roles are enforced server-side**, not just hidden in
   the UI — every route must call `requireMembership` with the right
   `allowedRoles`, and viewer-scoped visibility (which fields a VIEWER can
   see) needs its own explicit filter, not just a UI toggle.
7. **Incident plan:** know, in writing, what you'd do and who you'd notify
   if a breach happened — POPIA (and most breach-notification laws) require
   notifying affected people and a regulator within a set window.
8. Run `npm audit` and update dependencies as part of the deploy process,
   not as an afterthought.
9. ~~Add an automated test suite for the money logic specifically~~ **Done.**
   `npm test` runs a Vitest suite (23 tests, `src/lib/billing/*.test.ts`)
   covering `allocateOldestFirst`/`statusForEntry` (the spec's own R2,800
   worked example, partial payments, overpayment→credit, topping up a
   partially-paid entry, skipping already-paid entries, a payment that runs
   out mid-list), `buildDrilldownTree` (sort order, cross-payment-type
   summing, zero/negative-amount filtering, empty input), and
   `hasActiveAccess` (trial expiry, active/past_due/canceled/incomplete, and
   the specific edge case of a cancelled subscription with a stale future
   trial date). Scope is deliberately narrow — pure, DB-free business logic
   only, no route/integration tests and no CI wiring yet (the next item on
   this list covers CI). Run `npm test` before merging any change to
   `src/lib/billing/*` or `src/lib/tenant.ts`.

## Reporting a problem with this list

If a future phase adds a table storing anything sensitive (bank details,
ID numbers, etc.), update this file in the same change — don't let the
security notes drift out of sync with the schema.
