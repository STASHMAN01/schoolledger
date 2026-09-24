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

## Phase 2, Session 3 -- verified live (2026-09-21)

Dylan ran the local checks (lint, test, build all clean), `npx prisma db
push` synced the new `form_documents` table, merged
`phase2-session3-form-templates` into `main` (clean fast-forward, 9
files, 958 insertions), and pushed. Vercel deploy went READY and
aliased to crechely.co.za within ~80s of the push.

Live-verified on crechely.co.za (real child: Boitshoko Kekana):
- Generated a Medical & Allergy Information PDF via the child profile's
  Forms card. Decoded the returned PDF's content stream directly
  (Chrome's built-in PDF viewer doesn't screenshot/read via this
  session's browser-automation tools -- a tooling limitation, not a
  product bug) and confirmed: letterhead logo embedded correctly,
  title, intro paragraph, the child's real profile data (name, DOB
  "May 14, 2022", gender "Female", class, enrolment date), blank
  underscore lines for the medical fields that aren't on file, the
  "not reviewed legal wording" disclaimer box, signature line, and
  footer stamp -- all exactly as designed.
- Generated a Fee Agreement & Payment Mandate and confirmed the money
  formatting: "Monthly fee: R1400.00 / month (Daycare standard rate)"
  pulled correctly from the category's rate. The Fee Agreement button
  was visible to Dylan (who has VIEW_MONEY) -- confirming the
  money-gate doesn't over-hide for a user who should see it. (Did not
  test the negative case -- a non-VIEW_MONEY user -- live, since that
  needs a second test account; the gating logic matches the same
  `useHasPermission` pattern already proven elsewhere in the app.)
- Confirmed dated history: both documents persisted as separate rows
  (not an overwrite), each showing the correct generator name and
  timestamp, with working "View" links opening the stored PDF inline.
- Confirmed audit logging: the activity feed shows "Dylan Maponga
  generated a Fee agreement & payment mandate" and "...downloaded a
  Fee agreement & payment mandate" (and the same for Medical &
  Allergy), matching the new `auditLabel.ts` cases.
- One button (Fee Agreement) didn't register a click through the
  browser-automation tool on the first two tries -- confirmed via a
  direct API call that the endpoint and generator both work correctly
  with the identical request, so this reads as an automation-click
  quirk (the Medical & Allergy button worked first try), not an app
  bug. Worth a real click from Dylan next time he's in the app, just
  to be sure.

Session 3 is done, merged, and live.

## Phase 2, Session 4 -- parent online form (2026-09-21, verified live)

Scoped with Dylan via three questions before building: submissions land
in a **pending-review queue** (never write straight to Child/Guardian),
**one link per child that expires** (7 days, not yet configurable),
and ID-document photos **back a specific existing field** (the child's
ID number, or a guardian's) rather than being a loose document dump.
Schema shown and approved before writing anything, per CLAUDE.md.

Shipped:
- New `SubmissionStatus` enum + `ParentFormLink` / `ParentSubmission` /
  `ParentSubmissionAttachment` models. The link stores only a token hash
  (same pattern as password-reset/invite tokens, reused directly from
  `src/lib/inviteToken.ts` rather than duplicated); the submission
  stores the parent's answers as one JSON blob (validated by the same
  `childProfileSchema`/`guardianSchema` rules that will eventually write
  it for real) so nothing is a real column until approved.
- Public, unauthenticated route: `/apply/[token]` (page) +
  `/api/apply/[token]` (GET to check/render, POST to submit). Rate
  limited two ways (per-IP and per-token-hash), same `rateLimit()`
  helper as forgot-password/reset-password. The parent enters DOB,
  gender, child ID number, one or more guardians (relationship, name,
  ID, occupation, phone, email), an explicit photo-consent checkbox,
  and can photograph the child's and each guardian's ID document
  (reuses the existing `ImageUploadField` client compressor unchanged).
- Staff side: a "Parent enrolment form" card on the child profile
  (generate a link, optionally email it to the child's billing contact
  email via the existing `sendMail` helper, dated history of links and
  their status) and a new **Pending reviews** page (list + a per-
  submission review page showing submitted-vs-current side by side,
  the ID-document photos, and Approve/Reject). Approving always creates
  **new** Guardian rows rather than trying to guess-match existing ones
  -- simplest safe first pass; staff can remove a duplicate manually.
  New "Pending reviews" nav link and a third dashboard tile (count,
  links to the list) alongside New this week / Enrolled.
- Audit-logged: link created, submission received, submission viewed
  (opening the review page, same reasoning as the ID-reveal audit --
  this page IS the reveal), approved, rejected.
- Gated by the existing `MANAGE_CHILDREN` permission throughout (no new
  permission needed) -- a TEACHER only sees/reviews submissions for
  their own assigned class, same scoping as every other child-facing
  endpoint.

Dylan ran the local checks, `npx prisma db push` synced the three new
tables, merged `phase2-session4-parent-form` into `main` (clean
fast-forward, 16 files, 1576 insertions), and pushed. Vercel deploy
went READY and aliased to crechely.co.za.

Live-verified on crechely.co.za (real child: Boitshoko Kekana):
- Generated a link from the child profile's new "Parent enrolment
  form" card; it rendered correctly (`https://www.crechely.co.za/apply/
  <token>`), showed a "Sent, not yet used" history entry, and Copy
  worked.
- Opened the link unauthenticated in a separate tab: correct child
  first name and centre name, full expected field set (DOB, gender,
  child ID number, child photo/ID-document uploads, one or more
  guardians with relationship/name/ID/occupation/phone/email/photo/
  ID-document, an explicit photo-consent checkbox).
- Submitted a full parent-style answer (DOB, gender, child ID number,
  one guardian) and got the "Thank you -- your submission has been
  sent to DEES DUCKLING CENTRE" success state; POST returned 201.
- The submission appeared immediately on the staff **Pending reviews**
  list with the correct child name and date, and the review-detail
  page rendered the submitted-vs-current diff table, the guardian
  block, and the Approve/Reject decision panel correctly.
- **Approve path**: clicked "Approve -- save to child & guardians" and
  confirmed via direct API reads afterward that `Child.photoConsentGiven`
  flipped to `true` with a fresh `photoConsentAt`, a brand-new Guardian
  row ("Thabo Kekana", Father) was created alongside the existing
  "Naledi Kekana" (Mother) rather than overwriting her, the submission
  left the pending list, and the child profile's photo-consent banner
  and guardians list both updated to match.
- **Reject path**: rejected a second (duplicate test) submission with a
  review note; it also left the pending list and the child profile's
  "Parent enrolment form" history correctly shows two dated entries,
  "Submitted, approved" and "Submitted, rejected", each with the
  reviewing staff member's name.
- Found and fixed a **test-tooling gap, not an app bug**: setting the
  photo-consent checkbox via the browser-automation tool's generic
  `form_input` action visibly checked the box on screen but didn't
  trigger the page's React state update, so that first submission was
  recorded with `photoConsentGiven: false` even though the checkbox
  looked checked. A native coordinate click on the same checkbox
  updated state correctly (confirmed by the Upload buttons unlocking
  live, and by `photoConsentGiven: true` in the resulting submission).
  Lesson for future live verification in this repo: always drive
  checkboxes with a real click, never `form_input`, and re-verify
  anything `form_input` touched.

Session 4 is done, merged, and live. Phase 2 (all four sessions --
statement PDF, admissions/enrolled workflow, seven form templates,
parent online enrolment form) is now complete and verified live on
crechely.co.za.

## Phase 3, Session 1 -- daily attendance (2026-09-21, built, not yet verified)

First session of Phase 3 (Daily running). New `AttendanceRecord` model
(one row per child per calendar day, `AttendanceStatus` PRESENT/ABSENT
only -- deliberately no Late/Excused in this first pass, matching the
plan's own wording) plus a new `MANAGE_ATTENDANCE` permission, defaulted
to Teacher (scoped server-side to their own assigned class, same rule as
MANAGE_CHILDREN), Receptionist (org-wide), and Manager.

Shipped:
- Teacher-facing register at `/dashboard/centre/attendance`: everyone
  defaults to Present, tap a child to flip them Absent, one "Save
  register" call upserts the whole class/day in one request -- built to
  match the plan's own "under a minute on a phone" bar. A TEACHER never
  sees a class picker (the API forces their assignedCategoryId); any
  other MANAGE_ATTENDANCE role picks a class from a dropdown first.
- Centre Management dashboard gets a fourth tile, Attendance (grid moved
  to 4 columns on desktop): Present is a plain number, Absent is a
  clickable link straight into the notify flow, and an untaken register
  shows "Not taken yet -- take register" instead of a 0.
- `/dashboard/centre/attendance/absent`: today's absent children (a
  TEACHER's own class only; anyone else sees every class) with a single
  "Notify absent parents (N)" button that emails every not-yet-notified
  parent with an email on file in one tap and marks `notifiedAt`, so a
  second tap never double-sends. Deliberately no 2-person approval gate
  here (unlike the money-reminders "send all") -- this is a same-day
  informational notice, not a request for money, and the plan explicitly
  wants it to be an immediate single tap.
- Audit-logged: one `attendance.marked` entry per register save (with
  the class name and present/absent counts, not one entry per child --
  would be noisy for a daily action) and one
  `attendance.absentParentsNotified` entry per notify tap (with the
  count actually sent).

NOT YET DONE -- blocks merge to main: `npx prisma db push` against
production for the new table, and Dylan's local lint/test/build pass
(same device-shell limitations as every prior schema-touching session --
`npx prisma validate` still 403s fetching engine binaries here). Manual
brace/paren-balance check across all 14 changed/new files passed; full
local verification is the real gate before this goes live.

## Phase 3, Session 1 -- daily attendance (2026-09-22, built and deployed)

Branch `phase3-session1-attendance` merged to `main` (commit `19aa372`,
then two follow-up lint/CRLF-hygiene commits) and pushed. Dylan's local
lint/test/build all passed clean (40/40 tests), `npx prisma db push`
synced the new `AttendanceRecord` table + `MANAGE_ATTENDANCE`
permission to production, and the Vercel production deploy is READY.

New: `AttendanceRecord` model (one row per child per day,
`@@unique([childId, date])`), `MANAGE_ATTENDANCE` permission (Teacher
scoped to own class via `resolveAttendanceScope`, also Receptionist/
Manager), a fast teacher register page
(`/dashboard/centre/attendance`), a dashboard Attendance tile, and a
one-tap "notify absent parents" flow
(`/dashboard/centre/attendance/absent`) with no 2-person approval gate
(deliberately different from the money-reminders pattern -- see the
comment in the route -- since this is same-day informational, and the
plan wants a single immediate tap). Audit-logged: one
`attendance.marked` per register save (aggregate counts, not per
child) and one `attendance.absentParentsNotified` per notify tap.

Two real bugs caught and fixed during the local-build gate (both
genuine code errors, not tooling artifacts): a `react-hooks/
set-state-in-effect` violation on the register page's initial-load
effect, and a Prisma Client type gap that resolved itself once
`prisma generate`/`db push` ran against the updated schema.

Also fixed a real, separate CRLF-drift bug surfaced while working
across the device bridge: Windows Git's `core.autocrlf=true` silently
converts the whole working tree to CRLF on any checkout even though
every blob in this repo is stored as LF. Added `.gitattributes`
(`* text=auto eol=lf`) and renormalized once so this can't recur.

NOT YET DONE: a live click-through on crechely.co.za (take a register,
mark someone absent, send the notify email, confirm the dashboard tile
updates). I can't do this myself -- it needs a staff login, and
entering a password to authenticate is outside what I'll do
automatically. Dylan, next time you're in the app: take today's
register for any class, flip one child to absent, save, then open
"Notify absent parents" and send -- if that all works end to end this
can be marked verified live.

## Phase 3, Session 2 -- to-do engine v1 (2026-09-22, built and deployed)

Same branch history as above, no schema change (deliberately designed
that way -- see the route's own comment -- so it didn't need a
migration-approval round trip). New `GET /api/organizations/
[organizationId]/todos` route + a shared `<TodoList />` widget
rendered at the top of both dashboard home pages (Centre Management,
Accounting). Every item is a live COUNT against existing data
(AttendanceRecord, ParentSubmission, the reminders helper) -- no new
table, no manual ticking, an item just stops being returned once its
underlying condition clears. Same TEACHER-vs-everyone-else scoping as
the rest of the app via the same `resolveAttendanceScope` helper.

One real bug caught by the Vercel production build (Dylan's local
build against the already-generated client didn't catch it until a
fresh install re-ran the type check): the pending-review to-do
queried `ParentSubmission.child`, which doesn't exist --
`ParentSubmission` has no direct child relation (nothing about a
submission is real until approved, per the model's own comment); fixed
to scope through `ParentSubmission.link.child` instead. A second,
related type error (`assignedCategoryId` typed as possibly `null`
even though the TEACHER-with-no-class case is already filtered out a
few lines earlier) needed an explicit narrowing rewrite. Both fixed
and redeployed; production build is clean as of commit `f1eb6d1`.

NOT YET DONE: live click-through of the to-do widget itself (same
login limitation as above) -- take an action that should clear a
to-do item (e.g. finish today's register) and confirm the widget
updates/disappears.

## Phase 4 -- Backup & export (2026-09-23)

Built and deployed (commit `ebcc544`, Vercel READY), pending live click-through.

- New `EXPORT_DATA` permission (ADMIN only by default; not in any other role's defaults).
- Settings > Backup & export (`/dashboard/accounting/settings/backup`): "Download full backup" POSTs to
  `/api/organizations/[organizationId]/export`, which returns an AES-256 encrypted ZIP. The password is
  generated per download (16 chars, no ambiguous glyphs), returned once in `X-Export-Password`, shown once
  in the UI, never stored. The page lists recent exports from the activity log (`entityTypes=Export`).
- ZIP contents: README.txt, `data/*.json` (org profile with decrypted bank account, classes, children,
  guardians, payment types, events + class ids, financial plan, payments + allocations + receipt numbers,
  credit balances, attendance, parent submissions, team, full activity log), per-child photos, form PDFs and
  one statement PDF per year with charges, parent-submission attachments, school logo/letterhead. Trashed
  rows are included. Never included: password hashes, token hashes, Paystack tokens.
- Logged as `export.downloaded` (entityType `Export`, counts in metadata), only after a successful build.
- Refactor: statement input building extracted to `src/lib/billing/statementData.ts`, shared by the child
  statement route and the backup.
- `@types/archiver` pinned to ^6.0.3 (v8 types describe archiver 8 and break the build with archiver 7).
- Build caught one lint error (`react-hooks/set-state-in-effect`), fixed with the same disable comment
  the Trash/Activity pages use.
- Import from backup: parked.

KNOWN RISK: the whole ZIP is built in memory with a 60 s function limit. Fine for a small preschool; a school
with hundreds of photos/form PDFs may need streaming or a background job later. Flagged, not built.

NOT YET DONE: live click-through -- download a backup as an admin, open it with 7-Zip using the shown
password, confirm the activity log shows "downloaded a full data backup".

## Phase 5 -- Run the centre (2026-09-23)

Decisions (one batched round with Dylan): staff = app users (Memberships) only; weekly Mon-Fri timetable per
class with teacher notification as a dashboard to-do (no email); Communication = per-class "parent added to
WhatsApp group" tick-list (no integration); complaints/reports parked until Dylan sends the rest of his notes.
Also decided: upgrade the Render Postgres to a paid plan before the ~2026-10-12 free-tier expiry (Dylan's action).

Schema (shown and approved): new `ClassScheduleItem` (class_schedule_items) and `WhatsAppGroupCheck`
(whatsapp_group_checks, unique per child per class) + back-relations on Organization/Category/Child.
No new permissions: MANAGE_CLASSES edits timetables; MANAGE_CHILDREN ticks the checklist (TEACHER: own class via
`resolveAttendanceScope`); Staff page/tile needs MANAGE_CLASSES or MANAGE_TEAM.

- Timetable page (`/dashboard/centre/schedule`): per-class week view, today highlighted; edit mode with add/remove
  rows and "copy Monday to every day"; whole week saved in one PUT (`/schedule`), audit `schedule.updated`.
- Teacher notification: `/todos` shows "Your class timetable changed" when someone else's latest
  `schedule.updated` for their class is newer than their latest `schedule.acknowledged`; opening the Timetable
  page POSTs `/schedule/acknowledge` (only writes a row when there is an unseen change). No extra column.
- Staff page (`/dashboard/centre/staff`) + home tile: members, role, class, flags teachers without a class;
  editing stays in Settings > Team.
- Upcoming Events tile: read-only from the existing Event model (`/events/upcoming`); amounts only returned with
  VIEW_MONEY; names link to the Accounting event page only with VIEW_MONEY + VIEW_ACCOUNTING; TEACHER sees only
  events for their class.
- Communication page (`/dashboard/centre/communication`): tick-list per class with "x of y added".
- Teacher dashboard shows today's timetable.
- Phase 4 backup now also includes timetables.json and whatsapp-group-checks.json.

NOT YET DONE: live click-through (see project-plan.md next steps).

## Final inspection + fix session A -- data exposure (2026-09-23)

Final inspection report: project doc claude/final-inspection-report.md. Fix plan (with Dylan's revision notes
and dashboard mock-up): claude/fix-plan.md. Session A shipped (no schema change):
- BUG (found by Dylan): /apply and /api/apply were missing from middleware PUBLIC_PATHS, so parents got sent
  to /login. Fixed.
- All child API responses go through src/lib/childView.ts: ID numbers always masked; fees, plan entries and
  credit blanked without VIEW_MONEY. Parent-submission review masks IDs and logs every view.
- Events routes need VIEW_MONEY. Fee Agreement download needs VIEW_MONEY. Fee override create/edit needs
  VIEW_MONEY. Activity feeds strip amounts for non-money roles; the Accounting dashboard shows Accounting activity only.
- TEACHER scoped on child restore, CSV import and sibling suggestions.
- Trashed children excluded from outstanding totals and reminders.
- Reset-password token claimed atomically; attendance summary class lookup org-scoped.
- Nav/settings links hidden when the page would only show "no permission".
- Default dates use the local date (lib/date.ts) -- no more "yesterday" before 02:00.
- Removed the Stripe editor's note from the privacy policy and the public "WhatsApp coming soon" lines.

## Fix sessions B + C -- billing safety, new-family applications, Centre rework (2026-09-23)

Decisions (Dylan, 23 Sept): both parent-link types; class age group as min-max months; Reports hidden until
defined; adding a child requires the core details (name, DOB, gender, class, a parent/guardian phone), and the
rest is flagged "incomplete".

Schema (diff shown and approved before db push):
- Restrict instead of Cascade on FinancialPlanEntry->Child, CreditBalance->Child, FinancialPlanEntry->Organization
  and Payment->Organization, so the trash purge / an org delete can never erase charges or credit (R7/R13).
- Indexes: AuditLog(org, entityType, entityId, createdAt); FinancialPlanEntry(org, status) and (org, year);
  Payment(org, date); Child(org, categoryId, archived, deletedAt).
- Category.ageMinMonths/ageMaxMonths. Organization.applyToken (encrypted) + applyTokenHash (unique).
- ParentSubmission.linkId is now optional, plus isNewApplicant and createdChildId.

Built:
- Permanent school application link (/apply/school/[token]) for new families: rate-limited, and nothing is created
  until staff approve it. Approval picks the class and start date, then creates the child (+ first year's fees)
  and guardians. Per-child one-time links unchanged. Emailed links use AUTH_URL, not the Host header.
- Classes API: parentId no longer accepted (flat list), fees hidden without VIEW_MONEY and only settable with it,
  age groups, and teachers + child count per class.
- Centre UI (Dylan's notes + mock-up):
  - Two-row header (mode switch far left; tabs on their own row; Communication/Support/theme/log out top-right;
    phones get a ☰ menu with 44px targets that closes on an outside tap).
  - Centre nav: Home, Forms, Enrolled, Admissions, Attendance, Classes, Timetable, Events, Staff.
  - Dashboard: tiles left (Admissions, Attendance present/absent, Online submissions, Enrolled, Staff, Upcoming
    events, Classes), centre-only activity below, and a portrait to-do panel on the right with a red total.
  - To-dos split by mode. New centre to-dos: add parents to the WhatsApp group; complete children's profiles.
  - New pages: Forms (school link, per-child link, blank printable forms), Classes (teacher, age group, count,
    add/edit), Events (read-only).
  - Pending reviews became "Online submissions" inside Admissions (old URL redirects). The Children tab was
    removed: Enrolled shows classes first, has "Add child" (core details required) and Excel/CSV import (.xlsx
    via read-excel-file), an incomplete-profile badge and filter, and search.
  - Import reads date of birth and gender, accepts SA phone formats (082...) and day-first dates.
  - Attendance register: a sticky full-width Save on phones, and no endless Loading/Saving on network errors.

## Fix session D -- robustness + clean-up (2026-09-23)

- Rate limiting: IP from the platform headers (clientIp), buckets pruned automatically, and the invite and
  platform-join token routes are now limited too (R9).
- No reset/invite links in production logs when SMTP isn't set up (R10). Password-reset emails use AUTH_URL (R11).
- Event charges immediately use a child's existing credit (B4).
- One hardened CSV escaper (quotes CR/LF, defuses =,+,-,@ formulas) used by the payments export too (D3).
- "category" -> "class" in the remaining on-screen text and errors (N1).
- Error messages instead of endless Loading on Admissions and Absent.
- Removed unused @auth/prisma-adapter, @tanstack/react-query, @types/bcryptjs and dead helpers (U1/U2).
- Stale root docs moved to docs/archive/ (U8).

Still open / Dylan's call: VIEWER role (U6), platform + testimonials area (U7), which parent contact wins
(D9), dropping the dead columns/enum values (U4/U5), the /categories URL rename, one money formatter everywhere
(D1), backup password in the body instead of a header (N5), and the POPIA items (encrypted file storage,
profile-view logging, wording audit, lawyer-reviewed operator agreement).

## Session E -- 24 Sept 2026: error messages + full add-child in Accounting
- Older pages no longer fail silently: Payments, Reminders (mark sent, send request, template), both child profiles (load, guardian edits, reveal ID), events, classes, payment types, billing, team, submission review and platform pages now show a message when a load or save fails.
- New dashboard-wide ErrorCatcher: catches any unhandled failure and shows a "Something didn't work -- please try again" banner (or an offline message) instead of nothing happening.
- Every .json() read is now guarded, so a server error page can't crash a screen.
- Accounting > Children > Add child now uses the same full form as Centre > Enrolled (core details required), plus an optional per-child monthly fee for money roles.
- No schema change. tsc, eslint, 61 tests all pass.
