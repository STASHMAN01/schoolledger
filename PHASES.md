# Build roadmap

Phased on purpose: each phase should be usable/testable before the next
starts, and security-relevant pieces (auth, tenant isolation) are built
first so every later phase builds on top of a safe foundation rather than
bolting it on afterward.

## Phase 0 — Foundations & security baseline ✅ (this drop)

- Next.js (App Router, TypeScript, Tailwind) + Postgres via Prisma.
- Multi-tenant schema: Organization, User, Membership(role), Invite,
  Category (self-referential), Child, PaymentType, FinancialPlanEntry,
  Payment, PaymentAllocation, Receipt, CreditBalance, AuditLog.
- Auth: email+password (NextAuth/Auth.js v5, Credentials provider), bcrypt
  hashing, short-lived JWT sessions, server-side tenant/role checks
  (`requireMembership`), rate limiting on login/register, security headers,
  audit logging, field-encryption helper for bank details.
- Registration flow creates an Organization + its first ADMIN user +
  starter payment types in one transaction.
- Minimal login/register/dashboard pages to exercise the above.

**Not done yet on purpose:** categories/children UI, payments, statements,
billing, invites-accept flow, notifications. See below.

## Phase 1 — Categories & children ✅ (this drop)

- Full CRUD for the category/sub-category hierarchy (unlimited depth),
  tenant-scoped and role-gated (ADMIN/ACCOUNTANT/MANAGER can manage,
  VIEWER can only view — enforced server-side in every route, not just
  hidden in the UI).
- Add/edit/archive/restore children, with server-side E.164 phone and
  email validation, an enrollment/exit date sanity check (exit can't be
  before enrollment), and a same-surname "possible sibling" flag surfaced
  on creation (detection only — joint statements/merging is a later phase).
- Every foreign key (a child's categoryId, a category's parentId) is
  re-validated against the caller's own organizationId server-side before
  being trusted — never assumed safe just because it parsed as a string.
- Archive is soft-delete only (an `archived` flag), never a hard delete,
  so an accidental click is always recoverable and no financial history
  attached to a child/category can vanish.
- Every create/update/archive/restore action writes an AuditLog row.

## Phase 2 — Payment types, financial plans & payments ✅ (this drop)

- Admin-editable payment types (recurring vs one-time, with a default
  amount for one-time types like Registration/Uniform/Trip). At least one
  active recurring type is always protected from deactivation server-side,
  since monthly plan generation depends on one existing.
- Annual FinancialPlanEntry generation, wired into child creation: monthly
  fee rows from enrollment month through December (category default or the
  child's fee override), plus the mandatory one-time Registration charge —
  created in the same DB transaction as the child, so a child can never
  exist without its plan, and a plan failure rolls back the child too.
- Exit date handling: setting a child's exit date cancels FinancialPlanEntry
  rows for months after exit (only if not already paid/partial) — history
  up to and including the exit month is untouched.
- Recording a payment: the oldest-first allocation waterfall
  (`src/lib/billing/allocation.ts`) is a pure, DB-free function so the
  money logic itself is easy to reason about/test in isolation from the
  Prisma transaction that calls it. A payment tagged to a specific one-time
  type (e.g. Uniform) applies directly to that entry; an untagged/general
  payment runs the waterfall across the child's outstanding *recurring*
  entries only, oldest first — it never silently absorbs an unrelated
  one-time charge. Leftover money becomes/increases a CreditBalance.
- CreditBalance auto-applies to newly-created entries (`sweepCreditIntoOutstanding`,
  called after plan generation) — the same allocation function reused, not
  duplicated.
- Auto-numbered receipts (`REC-{year}-{6-digit sequence}`) created inside
  the same transaction as the payment.
- Role boundary: ADMIN/ACCOUNTANT can record payments; MANAGER can organize
  children/categories but not record money movement, matching the roles
  in the original product doc — enforced server-side, not just hidden in
  the UI.
- Minimal UI: record-payment form with category→child→payment-type
  selection, a filterable payment history table, a payment-types settings
  page (admin-only), and a per-child ledger page showing every
  FinancialPlanEntry with its due/paid/status.

**Known simplification, flagged for later:** which recurring PaymentType a
category's monthly fee bills under is currently "the org's oldest active
recurring type" rather than a per-category mapping — fine while most
schools have one recurring type (School Fees), revisit if a school needs
e.g. Aftercare billed as its own recurring line. Receipt numbering uses a
count-based sequence inside the transaction, fine at this product's scale;
move to a dedicated DB sequence if payment volume ever gets heavy enough
for that to matter.

## Phase 3 — Statements & the home dashboard ✅ (this drop)

- On-demand PDF statement generation via `pdf-lib` — a pure-JS library
  (no headless browser, no native binary), chosen specifically so
  generation works the same in a serverless function on Vercel as it does
  anywhere else, with nothing to install at deploy time. Shows school
  name/address/banking details (a text-based letterhead-lite — an actual
  uploaded logo/letterhead image is deferred until file storage is wired
  up, see below), a month-by-month table oldest-to-latest per spec, totals,
  and the credit balance if any.
- Joint statements: the child detail page detects other active children
  sharing a surname and offers to include them; the statement endpoint
  re-validates every included child id against the caller's own
  organization (never trusts an id list from the client) and renders a
  combined document with a grand total, satisfying the "export as one"
  requirement without a new "family" data model — a real family/payer
  concept can still be added later if needed.
- Home dashboard: clickable "Outstanding" and "Paid this month" totals that
  expand into category → payment type → child, exactly the drill-down
  described in the product doc; "Accounts due" listing every child with a
  balance, linking straight to their ledger; a children count; and an
  activity feed built from AuditLog, rendered through one humanizer
  (`src/lib/auditLabel.ts`) so "Frank recorded a payment of R1,400" reads
  the same everywhere it's ever shown.
- The two "pure function" pieces added this phase —
  `allocateOldestFirst`/`statusForEntry` (Phase 2) and the new
  `buildDrilldownTree` — were both exercised with a small standalone test
  script during development (not checked into the repo as a test suite
  yet — see below) covering the spec's own worked example (R2,800 across
  June+July), partial payments, overpayment→credit, topping up a
  partially-paid entry, and dashboard aggregation/sorting. All passed.

**Known simplifications, flagged for later:** dashboard aggregation is
computed in JS from a full fetch of outstanding entries/allocations rather
than a SQL `GROUP BY` — fine at this product's expected scale (one school's
children), revisit if a very large multi-thousand-child organization ever
shows up. No actual test suite/CI is wired up yet — the verification above
was a manual one-off script; adding Vitest/Jest for the pure business-logic
functions (allocation, dashboard tree, financial plan generation) is
worthwhile before this gets much bigger, since those are exactly the
functions a regression would be most costly in. Logo/letterhead image
upload needs file storage (e.g. Vercel Blob / S3) — not yet wired up.

## Phase 4 — Billing ✅ (this drop)

- Stripe Checkout for subscription signup (monthly/yearly — real prices are
  set in the Stripe Dashboard as Price objects; this app only needs their
  IDs in env vars, so pricing can change without a code change) and the
  Stripe Billing Portal for self-service plan management/cancellation.
- A signature-verified webhook (`/api/webhooks/stripe`) is the single
  source of truth for subscription state — the app never trusts a
  checkout redirect alone (a user closing the tab, or a failed redirect,
  must never leave the organization stuck as unpaid when Stripe actually
  charged them, or vice versa). Every Stripe subscription carries the
  organizationId in its metadata, set at checkout time, so the webhook can
  update the right organization without an extra lookup.
- Access gating is enforced in exactly one place —
  `requireMembership()` in `src/lib/tenant.ts` — so a lapsed trial or
  cancelled subscription locks out every organization-scoped API route
  automatically, not just the ones someone remembered to check. The billing
  checkout/portal routes explicitly opt out of that check (`skipAccessCheck`)
  since an organization with no access still needs to be able to pay.
  `past_due` still gets access (Stripe's own retry/dunning schedule runs
  before it becomes `canceled` — cutting a school off after one failed card
  charge would be a worse experience than trusting Stripe's grace period).
- A persistent, unmissable banner shows on every dashboard page once access
  lapses, with one-click Subscribe buttons for ADMIN (matching the
  billing-is-admin-only rule from the original role spec); everyone else
  sees why the school is locked out instead of confusing failures.
- `hasActiveAccess()` (`src/lib/billing/access.ts`) is a small pure
  function and was verified with a standalone test script covering trial
  expiry, active/past_due/canceled/incomplete states, and the specific edge
  case of a cancelled subscription with a stale future trial date (must
  NOT regain access) — all passed.

**Known simplification, flagged for later:** pricing is currently one fixed
USD price per plan for every organization regardless of `currencyCode` —
fine to launch with, revisit if schools outside a USD/ZAR comfort zone need
localized pricing. No proration/plan-upgrade UI beyond what Stripe's own
Billing Portal provides out of the box.

## Phase 5 — Team invites ✅ (this drop)

- ADMIN-only invite flow: create an invite (email + role), get back a
  one-time link to send yourself — actual email-sending isn't wired up yet
  (needs a provider like Resend; noted below), so for now the admin copies
  the link and sends it however they like.
- The invite token itself is the same pattern as a password-reset token:
  the raw token is shown exactly once at creation and never stored — only
  its SHA-256 hash is (`src/lib/inviteToken.ts`) — so a leaked database
  dump hands out no usable invite links, same reasoning as password hashing.
- Accepting an invite is the *only* way a second person ever joins an
  organization (no self-serve "join any school" path exists anywhere).
  Every path through `/api/invites/accept` ends in proving control of the
  invited email address: either an existing session already signed in as
  that exact email, or a brand-new password set right there. An invite for
  an email that already has an account explicitly refuses to let a new
  password silently take it over — it tells the person to log in first,
  which is what closes off the account-takeover angle a naive
  implementation would leave open.
- Invite links work for someone who isn't logged in yet — `/invite` and
  `/api/invites` are the only new additions to the public-paths list in
  `src/middleware.ts` (the token, not a session, is what's checked).
- A team settings page (admin-only) lists current members, lists/revokes
  pending invites, and creates new ones. Invite/accept/revoke are all
  logged to the activity feed via the same audit humanizer used everywhere
  else.

**Deferred to later:**
- **Email sending.** Wiring up a transactional email provider (Resend is a
  reasonable default — simple API, generous free tier) so invites (and
  later, payment reminders) actually land in an inbox instead of needing
  the admin to copy/paste a link.
- **Per-field VIEWER scoping** — the original product doc describes an
  admin controlling exactly which fields a viewer can see (outstanding
  amounts vs. children count vs. payments made). Right now VIEWER is a
  single all-or-nothing read-only role. Worth adding once a real customer
  asks for it, since the "right" granularity (per-field? per-category?)
  is worth confirming against an actual need rather than guessing.

## Phase 5.5 — Automated test suite ✅ (this drop)

- Formalized the manual/ad-hoc verification scripts used during Phases 2-4
  into a real, repo-committed Vitest suite (`npm test`): 23 tests across
  `src/lib/billing/allocation.test.ts`, `src/lib/billing/dashboard.test.ts`,
  and `src/lib/billing/access.test.ts`.
- Covers the three pieces of business logic where a silent regression is
  most expensive: the oldest-first payment allocation waterfall (including
  the spec's own R2,800 worked example and a "payment runs out mid-list"
  case not previously covered by the ad-hoc scripts), the dashboard
  drill-down aggregation (sort order, cross-payment-type summing,
  zero/negative-amount filtering), and the subscription access gate
  (trial expiry, every Stripe status, and the cancelled-with-stale-trial-date
  edge case).
- Deliberately scoped to pure, DB-free functions only — no Postgres/Prisma
  spin-up needed to run it, so `npm test` works the same in this sandbox,
  in CI, or on any dev machine without a database configured. Route-level
  integration tests are still a gap (see SECURITY.md item 9) — worth adding
  once CI is wired up, since those need a real (or test-container) database.
- This satisfies SECURITY.md's pre-launch checklist item 9. The remaining
  open items on that checklist (TLS/hosting config, managed Postgres +
  backups, secrets management, privacy policy/POPIA, CI wiring, incident
  plan) are deploy/legal/ops work rather than code, and are the natural
  next focus before onboarding a real paying school.

## Phase 5.6 — Legal document drafts ✅ (this drop)

- First drafts of `legal/PRIVACY_POLICY.md` and `legal/TERMS_OF_SERVICE.md`,
  written specifically for what this product actually does (records
  children/family data on a school's instructions, isolates it per
  organization, encrypts bank details, bills via Stripe) rather than a
  generic template — includes the operator/responsible-party split under
  POPIA (the school controls what's collected and why; TinyLedger
  processes it on the school's instructions), subprocessor disclosure
  (Stripe, hosting/DB providers — placeholders until finalized), retention,
  and a security-incident notification commitment matching SECURITY.md.
- **Explicitly marked DRAFT, not legal advice, not reviewed by a lawyer.**
  Both files are full of `[BRACKETED PLACEHOLDERS]` for the specific
  business decisions only you can make (legal entity name, registered
  address, refund policy, data retention periods, governing jurisdiction)
  and flag the liability-limitation clause specifically as needing a
  lawyer's drafting, not a template fill-in — South African consumer
  protection law puts real limits on what that clause can say. Do not
  publish or start charging real customers on these as-is.
- This is a starting point to hand to a lawyer, not a finished legal
  document — see SECURITY.md item 5 for the honest status.

## Phase 6 — Events ✅ (this drop)

- The one real gap left from the original spec (section 9): a class-wide
  one-time charge — "September Trip — R750, applies to Ducks" — created
  once and automatically applied to every active child in the selected
  category/categories.
- Reuses the existing PaymentType/FinancialPlanEntry machinery instead of
  building a parallel concept: creating an Event auto-creates its own
  dedicated one-time PaymentType (flagged `isEventType`, so it's hidden
  from the manually-curated Payment Types settings list but still works
  exactly like any other one-time type for recording/allocating a
  payment), then generates a FinancialPlanEntry for every child in the
  target classes who's actively enrolled as of the event date — all in one
  transaction, so an Event can never exist half-created.
- Admin/Accountant can remove an individual child from an event (deletes
  their charge) — e.g. a child not attending the trip — but this is
  blocked once that child has paid anything toward it, so a receipt or
  payment allocation can never end up pointing at a deleted charge; the
  error message points toward recording a manual refund/adjustment
  instead.
- Event charges are ordinary FinancialPlanEntry rows, so they automatically
  show up in the dashboard drill-down (under the event's own name, like any
  other payment type), the per-child ledger, statements, and the activity
  feed — no changes needed to any of those.
- New `/dashboard/events` (list + create) and `/dashboard/events/[id]`
  (per-child status, remove) pages; role boundary matches payments/payment
  types (ADMIN/ACCOUNTANT can create and manage, MANAGER cannot — events
  move money).

**Known simplification, flagged for later:** no whole-event deletion (only
per-child removal) — the spec doesn't call for it, and deleting an Event
outright raises the same "what about children who already paid" question
per-child removal already handles carefully; revisit if a real customer
needs to undo an entire event. Also unaddressed here: bulk import/CSV for
existing schools switching from a spreadsheet — worth scoping once there's
a real onboarding customer to design it against.

## Phase 7 — Payment reminders ✅ (this drop)

- A `/dashboard/reminders` page listing every child with an outstanding
  balance, each with a ready-to-send message ("Hi Mrs Smith, this is a
  friendly reminder from Dee's Duckling Centre that Alice's account has an
  outstanding balance of R1400.00...") that the admin can edit before
  sending.
- Deliberately manual-send rather than automated: a WhatsApp button opens
  `wa.me` with the message pre-filled, an Email button opens the parent's
  configured mail client via `mailto:`, and a Copy button covers everything
  else — no transactional email provider account, API key, or per-message
  cost needed to ship this. This matches the original spec directly
  ("automated WhatsApp/SMS sending" is explicitly out of scope; "manual
  share" is explicitly fine) rather than being a corner cut.
- "Mark as sent" (auto-triggered by clicking WhatsApp/Email, or manually)
  records `Child.lastReminderSentAt` and writes an audit log entry, so
  whoever's doing month-end reminders can see who's already been nudged
  without cross-checking the activity feed for each child one at a time.
- Message-building, the wa.me link format, and the mailto link format are
  pure functions (`src/lib/billing/reminders.ts`) with their own Vitest
  suite (4 new tests, 27 total) — same "isolate the logic that's easy to
  get subtly wrong" pattern as the allocation waterfall and dashboard tree.
- Small refactor alongside this: extracted the currency-symbol formatting
  that only lived inside the statement PDF generator into a shared
  `src/lib/money.ts`, since the reminder message needed the same "R" vs
  "$" logic and duplicating it would have let the two drift apart.

**Known simplification, flagged for later:** no scheduled/automatic
reminders yet (e.g. "email everyone who's overdue on the 1st of the
month") — this phase is the manual, one-click-per-parent version. Automating
it is a natural next step once a transactional email provider is wired up
(see SECURITY.md/README — Resend was the suggested default) and a school
actually asks for it, per the "speed to first customers" decision not to
build ahead of real demand. Per-child custom due dates (vs. everyone owing
by month-end) mentioned in earlier planning notes also isn't built — no
customer has needed it yet and it wasn't part of the core spec's Section 5
exit/enrollment rules.

- Backup/export tooling, OCR-on-proof-of-payment, other items from
  `18_FUTURE_FEATURES.txt` in the Android project — revisit once there are
  real users to prioritize against, per the "speed to first customers"
  decision.
