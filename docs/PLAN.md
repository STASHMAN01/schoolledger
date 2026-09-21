# Crechely — Centre Management build plan

Source: Dylan's 19 Sept dictated notes, organized 21 Sept 2026
(`crechely-centre-management-plan.txt`), tracked in the Claude project as
`project-plan.md`. This file is the copy that lives in the repo so Claude
Code can read it without the project tool.

Goal: move Crechely from a billing-only tool to full centre management,
via two modes switched top-left — **Centre Management** and **Accounting**
(today's app: fees, payments, statements, reminders). Billing is never
visible unless the user clicks into Accounting.

Principles: simple beats complete. Every dashboard tile is a number that's
also a link (number → list → profile). Roles decide visibility (owners see
everything, managers don't see money, teachers see only their own class).
The school's data is the school's — nothing public.

Work ONE phase at a time, only the phase named. If something isn't in this
plan or contradicts it, stop and ask instead of guessing.

## Phase 0 — Revenue first (no new features)

Not a Claude Code phase — Dylan is doing this via Cowork/outreach: Paystack
verified and checkout migrated, site audit fixes (legal pages, contact
route, proof, share previews), outreach to 20-30 preschools.

Gate to Phase 2: Paystack live + at least one paying school, OR several
prospects specifically asking for enrolment features.

## Phase 1 — Restructure (S–M) — DO NOW

- Categories → Classes everywhere: screens, statements, PDF exports,
  emails, API routes, Prisma model/field names where reasonable without
  a risky migration. Flat list — no parent/child hierarchy in the UI
  going forward (existing `parentId` self-reference can stay in the
  schema for now; just stop exposing/using it as a hierarchy in Phase 1).
- Mode switch, top-left: **Centre Management** / **Accounting**. Existing
  billing screens move under Accounting unchanged. Centre Management
  starts as an empty home (a placeholder dashboard) — its real tiles are
  Phase 2+.
- Roles: add `TEACHER` (own class only) and `RECEPTIONIST` (adds
  children) to the Role enum. Class assignment: admin can assign any
  class to any teacher. Managers keep their existing "cannot see money"
  restriction — audit it's actually enforced server-side, not just
  hidden in the UI.
- Activity feed splits by mode: centre actions vs. accounting actions.
- Login rate limiting: 5 failed attempts per account+IP per 15 minutes,
  then slow/lock. Generic error messages (don't reveal whether the
  account exists).

**Done when:** billing works exactly as before under Accounting, all
tests pass, lint and a production build are clean, and the word
"category"/"Category" no longer appears anywhere in the product (UI
copy, emails, PDFs) — the underlying DB table/model name can stay
`Category` if renaming it is a risky migration; that's a naming/schema
decision to flag, not assume.

## Website track — Live Demo page (M), before Phase 2

Not a Claude Code phase yet — needs Dylan's example website first. A demo
school with sample data that resets on a schedule, no signup required.

## Phase 2 — Enrolment (top priority) — split into 4 sessions

1. **Profiles + photos + consent.** Child/parent profiles mirroring the
   paper form (name, surname, ID number, photo; parent names/surnames/ID
   numbers/occupation/photos; enrolment details). No money on this side.
   Mask ID numbers by default with an audit-logged reveal. Photo consent
   tick required before storing. Ethnicity: optional field or omit
   entirely — do not build the ethnicity chart until Dylan confirms a
   legal check (see plan decision #5).
2. **Admissions + Enrolled tiles.** Admissions: new children, sortable
   Today/Week/Month, with Exits inside it (not a separate dashboard
   tile). Enrolled: total learners → charts (gender, age; ethnicity only
   if resolved) → classes with counts → class list → child profile. New
   admissions billed from admission date (see plan decision #2 for
   pro-rata vs full month).
3. **Pre-built form templates.** Five customisable templates
   (enrolment, re-registration, indemnity confirmed; two more TBD — see
   decision #6). School uploads logo/letterhead once, applied
   automatically. PDF export. Build as a form builder (fields + template),
   not arbitrary PDF editing.
4. **Parent online form.** Link sent to parent, fills in on phone,
   photographs documents (stored as attachments, no OCR — deferred).
   Answers land in the child's profile; school can download as PDF.
   Rate-limit the public link, restrict file types/sizes, POPIA notice
   at the top.

**Before any phase 2 work ships with real school data:** privacy/terms/
POPIA pages live, photo consent wording, encrypted-at-rest file storage,
audit log on profile views and exports.

**Done when:** a school sends a link, a parent completes it on a phone,
and a full profile + PDF exist without the school typing anything.

## Phase 3 — Daily running — split into 2 sessions

1. **Attendance.** Teachers mark attendance per class. Attendance tile:
   Present = number only (not clickable), Absent = clickable list with
   notify-parents by email.
2. **To-do engine v1.** 3-4 tasks the app can actually observe (e.g. new
   child admitted → generate and send statement). Clears itself on the
   observed action — no manual ticking.

Teachers see only their own class (enforce server-side).

**Done when:** a teacher can take the register on a phone in under a
minute, and absent parents are emailed in one tap.

Pricing note (not a code task): once Phases 2-3 ship, new schools pay a
higher price, existing schools keep their rate.

## Phase 4 — Backup and export

Owner/admin "download everything" (records, forms, statements, payments)
as a password-protected file, with an export log. Import from backup is
parked, not this phase.

## Phase 5 — Run the centre

Staff tile + assignments, daily schedules per class with teacher
notifications, Upcoming Events tile tied to event billing, Communication
tab (manual WhatsApp-group checklist, no integration), complaints/reports
once the rest of Dylan's notes surface.

## Parked (do not build without explicit sign-off)

Upload-and-edit any PDF (Adobe-style), OCR, import from backup, sending
from a school's own Gmail, any WhatsApp integration.

## Open decisions (see project doc for full list — ask before assuming)

1. Exits: inside Admissions only (not also broken out in Accounting) —
   **resolved 2026-09-21.**
2. Mid-month admission: full month regardless of admission date, no
   pro-rata, no separate registration fee — **resolved 2026-09-21**
   (matches existing financialPlan.ts behavior; no code change needed).
3. Default mode on login: last-used mode, per user.
4. Receptionist: new role (as scoped in Phase 1) — confirmed, not a
   Manager preset.
5. Ethnicity: dropped entirely, no field or chart — **resolved
   2026-09-21.**
6. Form templates: enrolment, re-registration, indemnity, plus
   medical/allergy information, photo/media consent, emergency
   contact/pickup authorization, and fee agreement/payment mandate —
   **resolved 2026-09-21** (7 total, not 5 — Dylan picked all four
   options offered instead of two).
8. Bring-your-own PDF: form builder + hand-recreating first schools'
   forms, not Adobe-style editing — confirmed approach.
9. Privacy wording: "processed only on the school's instructions"
   replaces "Crechely can't access it" — confirmed, use this wording
   anywhere the old phrasing appears.
10. Absence notifications: email only to start — confirmed.
11. Categories are a flat list, no hierarchy — confirmed (see Phase 1).

## Phase 2 gate — explicitly skipped 2026-09-21

Phase 0's gate (Paystack live + a paying school, or several prospects
asking for enrolment) was NOT confirmed met. Dylan chose to start Phase 2
anyway rather than wait — his call, recorded here so it's not mistaken
for the gate having actually been cleared.
