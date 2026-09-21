# Progress log

Running log of what shipped, per phase, and any decisions made along the
way. Add a line here at the end of each session, before merging.

## Phase 1 — Restructure

Branch: `phase-1-restructure` (not merged to main — Dylan merges).

Shipped so far (commit 7106575):
- Classes UI flattened: no more parent-class picker or indented tree on
  the Classes management page. Scoping decision: left the DB/API
  `parentId` field and the financial dashboard's category-tree rollup
  (DrilldownTree.tsx / CategoryNode) untouched — those are a billing
  reporting concern, not the class-management hierarchy the plan meant
  to remove. Flag if that reading's wrong.
- Login rate limiting tightened to match the plan's "5 in 15 minutes",
  and added a second per-IP limit (20/15min) alongside the existing
  per-email one, so one IP can't spray one password across many accounts.
- Activity log shows "Class" instead of "Category" for entity-type
  badges (display-only relabel, DB value untouched).

Not done yet (still on this branch or not started):
- Mode switch (Centre Management / Accounting), top-left, with billing
  screens moved under Accounting.
- Roles: TEACHER, RECEPTIONIST, class assignment — needs a Prisma schema
  change (Role enum + a class-assignment relation), which per CLAUDE.md
  needs Dylan's approval on the migration SQL before it's written.
- Activity feed split by mode — needs a design decision on whether it's
  a schema tag (migration) or computed from entityType (no migration);
  leaning toward the latter, not started.
- Route/nav copy still says "Categories" in the URL segment
  (/dashboard/categories) and NavLinks href — left as-is since it's not
  visible product copy, only a URL slug; flag if Dylan wants that
  renamed too.

Blocker: `npm run lint`, `npm test`, and `npm run build` would not
complete inside this session's device shell — they hang with near-zero
CPU usage, which looks like an I/O stall specific to Node's module
resolution over the mounted folder, not a code problem. These checks
must be run locally, in a real terminal, not through the device bridge.

Verified locally by Dylan (commit 7106575): lint clean, 40/40 tests
passed, production build compiled and type-checked clean after running
`npx prisma generate` (stale/missing generated client on this machine,
unrelated to Phase 1 — a pre-existing issue caught by the build, now
fixed) and after fixing one real bug of mine: a leftover `roots`
reference in the Classes page after the flatten (commit 87b457f).

## Phase 1 continued — mode switch (commit 1f911ad)

Added the Centre Management / Accounting mode switch. Billing dashboard
moved from /dashboard/* to /dashboard/accounting/* (URLs change, no
behavior change). New /dashboard/centre home (near-empty, per plan).
New /dashboard smart-redirect based on a `crechely-mode` cookie,
defaulting to Accounting. Activity feed now genuinely splits: Accounting
excludes Child/Class entries, Centre Management shows only those.

Scoping calls made without asking (flag if wrong):
- Settings (incl. Billing, Team) stays fully under Accounting — no
  Centre-side settings exist yet, splitting it wasn't asked for.
- Old bookmarked URLs like /dashboard/children now 404 (no redirect
  shim added) — fine with no live customers, per Dylan.
- Mode switch button reads "Centre Management" / "Accounting" (short
  "Centre" on narrow screens) — not verified against a UI mockup since
  none has been uploaded yet.

Not verified yet: I could not run lint/test/build myself for this
commit either (same device-bridge limitation as above). Dylan needs to
run the same 3 commands plus click through: switch modes via the
top-left toggle, confirm Accounting nav/pages all still work at their
new /accounting/* URLs, confirm Centre Management home loads and (after
adding/editing a child or class from Accounting) shows it in "Recent
centre activity", and confirm the Settings dropdown/Billing/Team pages
are unaffected.

Still not done in Phase 1: Teacher/Receptionist roles + class
assignment (needs a schema migration — will show the SQL for approval
before writing it, per CLAUDE.md), and the route slug rename
(/dashboard/accounting/categories still says "categories" in the URL,
not "classes" — left as-is per the original scoping note, flag if
Dylan wants it renamed too).

## Phase 1 continued — roles & permissions (branch phase1-roles-permissions, commit 1b63ae7)

Added TEACHER and RECEPTIONIST roles plus a full per-person permission
system, replacing every hardcoded role-array check in the API with a
closed set of 14 Permissions (src/lib/permissions.ts). Each role has a
hardcoded default permission set; an admin can now grant/revoke any one
permission for any one person from Settings -> Team, independent of
their role, and undo it just as easily -- this was an explicit design
request from Dylan mid-session, replacing the earlier "just add the two
roles" scope.

Schema (NOT YET APPLIED to the database -- see below): new Permission
enum, new membership_permissions table, Membership.assignedCategoryId
(a Teacher's one class), Role gains TEACHER/RECEPTIONIST.

Audited and fixed the thing Phase 1 asked to audit: "Managers keep their
existing 'cannot see money' restriction" was never actually true -- a
MANAGER could view GET /payments, the dashboard's financial totals, and
generate statements. Fixed by gating those (plus the reminders/
outstanding list) behind a new VIEW_MONEY permission, which MANAGER (and
VIEWER, for the same reason) no longer gets by default. Grantable back
per-person via an override.

TEACHER's children access is scoped server-side to their
assignedCategoryId in every children route, not just hidden in a nav
link -- "own class only" per the plan.

Scoping calls made without asking (flag if wrong):
- Individual child records (GET /children/:id) stay visible to any
  member, including their fee/plan-entry data -- only fixed the
  "list of money" surfaces (payments list, dashboard totals, statements,
  reminders list) that the audit specifically found. Fully redacting an
  individual child's own financial history from Manager would be a much
  bigger Children-page redesign and wasn't what was asked.
- A role with SEND_REMINDERS but not VIEW_MONEY (Manager, by default)
  can no longer open the Reminders page at all, since that list is
  inherently shaped like money (shows exactly what each parent owes).
  They keep SEND_REMINDERS for whenever Centre Management grows its own
  reminders view; there's no page for it to power yet.
- Payment-types management (create/edit/deactivate) mapped to the new
  MANAGE_SETTINGS permission (was ADMIN-only already, unchanged).
- Team page tooltips use the native `title` attribute (hover to see a
  description), not a custom tooltip component.

NOT YET DONE -- blocks this from being pushed to main:
`npx prisma db push` (this project has no tracked migrations directory,
so db push is how schema changes reach the database here) has NOT been
run. Vercel's build will regenerate the Prisma Client fine on its own
(prisma's own postinstall hook), but nothing applies the new
enum values/table/column to the actual database -- and dashboard/
layout.tsx (used by every single /dashboard/* page) now queries
Membership.permissionOverrides unconditionally, so deploying this
before the db push would 500 the entire dashboard for every user,
immediately. Dylan needs to run db push himself against production
first; I don't have and shouldn't use production DB credentials.

## Phase 1 — closed out (commit c606179 and this note)

Verified live on crechely.co.za after `prisma db push` + merge to main:
Team page renders all 6 roles, ADMIN members correctly show
"always full access, not customizable", and a throwaway TEACHER invite
was created and revoked cleanly (no real member touched) to confirm the
new role/permission plumbing works end-to-end in production. Lint,
tests (40/40), and build were all clean before merge.

Phase 1's "done when" bar is met: billing works unchanged under
Accounting, roles/permissions/class-assignment/managers-can't-see-money
are live, activity feed splits by mode, login rate limiting matches the
plan (5/15min per account, 20/15min per IP), and no user-visible UI
copy, PDF, or email says "Category"/"Categories" anymore (checked
statementPdf.ts, outstandingReminders.ts, NavLinks.tsx, and every
dashboard page's JSX — all say "Class(es)").

One nit still open, flagged twice now, not resolved: the URL segment
`/dashboard/accounting/categories` (and its API route
`/api/organizations/[organizationId]/categories`) still literally says
"categories", not "classes". Left alone again — renaming it means
touching ~10 frontend fetch call sites and the route folder itself, for
a URL nobody but Dylan will ever read, and no live customers exist yet
to worry about broken bookmarks either way. Needs an explicit "yes,
rename it" before it's worth the diff.

Not done, out of Phase 1's scope, and explicitly gated in PLAN.md before
starting: Phase 2 (Enrolment) requires Phase 0 (Paystack live + >=1
paying school, or several prospects asking for enrolment) to be met
first — that's Dylan's outreach status, not something visible from the
code. Also several of PLAN.md's "open decisions" bear directly on how
Phase 2 gets built (exits placement, pro-rata vs full-month billing,
ethnicity field, the two undecided form templates) and the plan
document itself says to ask rather than assume on these.

## Phase 2, Session 1 — profiles, photos, consent (branch phase2-session1-profiles, commit 874b36e)

Dylan explicitly chose to skip the Phase 0 revenue gate and start Phase 2
now (see docs/PLAN.md). Also resolved this session, before building:
exits stay inside Admissions only; mid-month admissions bill the full
month (no pro-rata/registration fee -- this needed no code change, it's
already how financialPlan.ts works); ethnicity dropped entirely; the two
extra form templates are actually four (medical/allergy, photo/media
consent, emergency contact/pickup authorization, fee agreement/payment
mandate) -- 7 templates total for Session 3, not 5.

Schema shown to Dylan and approved before writing (per CLAUDE.md): new
Guardian model + Child.dateOfBirth/photoImage/photoConsentGiven/
photoConsentAt, all additive. See schema.prisma comments for the full
reasoning, and this branch's commit message for the complete list of
scoping calls made without asking.

Shipped: masked-by-default ID numbers (child's, parent's, each
guardian's) with an audit-logged reveal endpoint; photo upload gated on
explicit consent, enforced server-side; a Centre Management children
list + per-child profile page (photo, DOB, guardians CRUD). This is
also, incidentally, the first time TEACHER/RECEPTIONIST can add a child
at all, since neither gets VIEW_ACCOUNTING by default and the only
add-child form used to live under Accounting.

NOT YET DONE -- blocks merge to main: `npx prisma db push` against
production (Dylan already has DATABASE_URL in his local .env from the
roles/permissions session, so this should just be running the command
again). Also could not get a full `tsc --noEmit` pass in this session's
device shell (hit the 180s tool cap) -- same as every prior
schema-touching session, needs Dylan's local lint/test/build after
`npx prisma generate`.

Not started yet: Phase 2 Sessions 2-4 (Admissions/Enrolled tiles, the 7
form templates, the parent online form).

## Phase 2, Session 1 — verified live (2026-09-21)

Confirmed end-to-end on crechely.co.za with a real child (Boitshoko
Kekana, Dees Duckling Centre): the photo-consent checkbox gates the
Upload control (hidden until checked, appears immediately after), added
a real guardian (Naledi Kekana, Mother) through the new form, and both
actions showed up correctly in the Centre Management activity feed
("added Naledi Kekana as a guardian", "updated a child's details").
`git push origin main` (c606179..6452f1e) and the Vercel deploy both
went out clean.

Noted, not fixed (pre-existing since Phase 1, not part of this
session's scope): the Centre activity feed shows every AuditLog entry
tagged entityType "Child", including ones that are really Accounting
actions logged against a child (payment reminders sent, statements
generated) — because CENTRE_ENTITY_TYPES matches on entityType, not on
which mode the action actually belongs to. Cosmetic/confusing, not
incorrect data. Flagging in case Dylan wants entity-type tagging
tightened later.

Starting Phase 2 Session 2 (Admissions + Enrolled tiles) next.

## Phase 2, Session 2 — built, not yet verified (2026-09-21)

Branch `phase2-session2-admissions-enrolled`. Schema change: optional
`Child.gender` (enum MALE/FEMALE/OTHER), approved by Dylan
(AskUserQuestion, "Yes, add it as optional") specifically to support the
Enrolled tile's gender chart -- deliberately not the same call as
ethnicity (dropped entirely, decision #5): gender wasn't flagged as
needing that same POPIA caution.

Shipped:
- **Admissions** (`/dashboard/centre/admissions`): children sorted
  newest-enrollment-first, with Today/This week/This month/All filter
  tabs (each showing a live count), plus an **Exits** section beneath
  it listing every child with an exit date set, newest exit first --
  inside Admissions, not a separate tile, per decision #1.
- **Enrolled** (`/dashboard/centre/enrolled`): total currently-enrolled
  count (excludes archived and anyone with an exit date -- Admissions'
  Exits section owns those), a gender breakdown chart, an age breakdown
  chart (computed from dateOfBirth in whole years, bucketed 0/1/2/3/4/5/6+
  plus Unknown), then classes with counts that expand in place to the
  children in that class, each linking to their profile.
- Chart colors follow the dataviz skill's method: gender is nominal
  categorical (fixed hue order, slots 1-3 of the skill's validated
  default palette -- documented in `palette.md` as clearing every
  CVD/contrast gate including all-pairs for exactly a 3-series chart
  like this), age is ordinal (one hue, monotone weight via opacity
  since only 3 categorical slots needed a light/dark hex pair and a
  full per-mode sequential step table wasn't available -- noted as a
  deliberate simplification in the component's comment, appropriate for
  an internal admin chart). New `--chart-cat-1/2/3` tokens in
  globals.css, defined for both light and dark like every other color
  in this app (no Tailwind `dark:` variant anywhere in this codebase --
  the whole app swaps via `:root[data-theme="dark"]`, so the chart
  tokens follow that same pattern rather than introducing a new one).
- Gender selector added to the Centre child profile page, wired to the
  same PATCH endpoint as date of birth.
- Two new stat tiles on the Centre Management home page ("New this
  week" -> Admissions, "Enrolled" -> Enrolled), plus nav links, per the
  plan's "every dashboard tile is a number that's also a link"
  principle.

No new API endpoints -- both pages reuse the existing
`/children` list endpoint and compute buckets/breakdowns client-side,
same as the Accounting dashboard's own pattern.

NOT YET DONE -- blocks merge to main: `npx prisma db push` against
production for the new `gender` column, and a full local
lint/test/build pass (this session's device shell couldn't run
`npx prisma generate` -- blocked fetching the engine checksum,
network-restricted -- or finish `npm run lint` before hitting the 180s
tool cap, same recurring limitation as every prior schema-touching
session). Needs Dylan's local verification before this can go live.

## Phase 2, Session 2 — verified live (2026-09-21)

Merged to main (39dd0b1), `prisma db push` applied, deployed and
confirmed on crechely.co.za:

- Set Boitshoko Kekana's date of birth (2022-05-14) and gender (Female)
  from the Centre child profile page -- both saved and persisted
  through a reload.
- Enrolled page recalculated live: total 2, Gender chart showed Female
  1/50% (orange) and Not specified 1/50% (gray), Age chart showed the
  "4" band 1/50% (blue) and Unknown 1/50% (gray) -- correct given the
  DOB set above and Joseph Mwenda having none. Classes section listed
  Daycare (1) and Aftercare (1); expanding Daycare correctly showed
  Boitshoko Kekana linking to her profile.
- Admissions page: filter tabs showed live counts (Today/This
  week/This month all 0, All 2 -- both children were enrolled before
  this session). Switching to "All" listed both children, newest
  first, each linking to their profile. Exits section correctly showed
  empty (neither child has an exit date).

Also hit the CRLF line-ending drift bug again on `git checkout main`
after merging (11 tracked files flipped to CRLF, equal
insertions/deletions per file, `core.autocrlf` still unset at both
local and global scope) -- fixed with `git checkout -- .` before
committing anything further. Same root cause as before, still
unidentified; keep checking `git status`/`git diff --stat` for
disproportionate changes after every checkout in this repo, not just
after edits.

Starting Phase 2 Session 3 (7 pre-built form templates) next.

## Phase 2, Session 3 — built, not yet verified (2026-09-21)

Branch `phase2-session3-form-templates`. Schema change: new `FormType`
enum + `FormDocument` model (one new table, no changes to any existing
model). Approved by Dylan via two rounds of questions first: (1) scope
-- PDF generation only for this session, pre-filled from data already on
file with blank lines for the rest (no in-app digital-capture form; that's
Session 4's parent-facing online form, a separate build); (2) history --
every "Generate" click creates a new dated FormDocument row rather than
overwriting the last one for that child+formType, since indemnity/photo-
consent/medical forms are dated records of what was handed out, not a
"current state" toggle like the existing photo-consent checkbox.

Shipped:
- 7 templates (`src/lib/forms/types.ts`): Enrolment, Re-registration,
  Indemnity, Medical & Allergy, Photo & Media Consent, Emergency
  Contact & Pickup Authorization, Fee Agreement & Payment Mandate.
- Generic pdf-lib renderer (`src/lib/forms/formPdf.ts`) -- letterhead
  header (same pattern as statementPdf.ts), title, intro paragraph,
  sections of label/value fields (printed where the system already has
  the value -- child/guardian/org data -- an underscored blank line
  otherwise), an optional disclaimer box, signature/date line, footer.
  Static only, no AcroForm fields -- matches decision #8 (form builder,
  not Adobe-style PDF editing) and this session's PDF-only scope.
- Per-template field builders (`src/lib/forms/templates.ts`) mapping
  child + guardians + org data into each template's sections.
  Indemnity/Medical & Allergy/Photo & Media Consent/Fee Agreement carry
  a visible "this is a fill-in-the-blank draft, not reviewed legal
  wording -- have a lawyer review it" disclaimer, since none of this
  wording has had that review (same caution the plan's own POPIA
  checklist already flags for site-wide legal wording generally).
- New API: GET/POST `.../children/[childId]/forms` (list metadata only
  / generate a new dated document) and GET
  `.../forms/[formId]/download` (serves the stored PDF, audit-logged
  the same way as the ID-number reveal -- these documents can carry
  real ID numbers, addresses, and for Fee Agreement, a fee amount).
  Fee Agreement additionally requires VIEW_MONEY on top of
  MANAGE_CHILDREN -- the one template with money in it, per "Centre
  Management shows personal info only, never money" -- so a
  Teacher/Receptionist without VIEW_MONEY sees the other 6 buttons but
  not that one.
- Forms card added to the Centre child profile page: a button per
  template plus a dated history list (type, date, who generated it, a
  View link).

NOT YET DONE -- blocks merge to main: `npx prisma db push` against
production for the new `form_documents` table, and a full local
lint/test/build pass (same recurring device-shell limitations as every
prior schema-touching session -- `npx eslint` alone hit the 170s tool
cap this time). Needs Dylan's local verification before this can go
live.
