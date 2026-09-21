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
