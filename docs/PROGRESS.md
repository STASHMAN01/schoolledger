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
resolution over the mounted folder, not a code problem. These 3 changes
are small and were reviewed by hand, but Dylan should run the real
checks locally before merging.
