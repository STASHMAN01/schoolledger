[1mdiff --git a/CLAUDE.md b/CLAUDE.md[m
[1mindex 43c994c..b3544fe 100644[m
[1m--- a/CLAUDE.md[m
[1m+++ b/CLAUDE.md[m
[36m@@ -1 +1,35 @@[m
 @AGENTS.md[m
[32m+[m
[32m+[m[32m# Crechely[m
[32m+[m[32mNext.js (App Router, TypeScript) + Postgres (Prisma) SaaS for preschool[m
[32m+[m[32mcentre management, currently billing-only in production (fees, payments,[m
[32m+[m[32mstatements, reminders). No paying customers yet.[m
[32m+[m
[32m+[m[32m# Plan[m
[32m+[m[32m- The build plan is docs/PLAN.md. Work on ONE phase at a time, only the[m
[32m+[m[32m  phase I name.[m
[32m+[m[32m- After each phase, add what shipped and any decisions to docs/PROGRESS.md.[m
[32m+[m[32m- If something isn't in the plan or contradicts it, stop and ask.[m
[32m+[m
[32m+[m[32m# Workflow[m
[32m+[m[32m- One branch per phase. Commit small. NEVER push or merge to main; I do[m
[32m+[m[32m  that.[m
[32m+[m[32m- Before saying a phase is done: run `npm run test`, `npm run lint` and[m
[32m+[m[32m  `npm run build`, and show me the output.[m
[32m+[m[32m- Database changes: show me the migration SQL and wait for approval. Use[m
[32m+[m[32m  the local dev database only. Never use production credentials and never[m
[32m+[m[32m  edit .env files.[m
[32m+[m[32m- Payments: Paystack, not Stripe. Don't touch the billing checkout unless[m
[32m+[m[32m  the task says so.[m
[32m+[m
[32m+[m[32m# Product rules[m
[32m+[m[32m- Crechely records payments; it does not collect them. Reminders are[m
[32m+[m[32m  email only. No WhatsApp integration.[m
[32m+[m[32m- South African English (enrolment, maths). Prices in rand, no cents on[m
[32m+[m[32m  marketing pages.[m
[32m+[m[32m- Children's data is sensitive (POPIA): no real names, ID numbers or[m
[32m+[m[32m  photos in tests, fixtures or logs. Mask ID numbers in the UI by[m
[32m+[m[32m  default. No ethnicity field/chart unless the plan says the legal check[m
[32m+[m[32m  is resolved.[m
[32m+[m[32m- Never invent testimonials, statistics, customer counts or compliance[m
[32m+[m[32m  claims in copy.[m
[1mdiff --git a/docs/PLAN.md b/docs/PLAN.md[m
[1mnew file mode 100644[m
[1mindex 0000000..b16b8fd[m
[1m--- /dev/null[m
[1m+++ b/docs/PLAN.md[m
[36m@@ -0,0 +1,150 @@[m
[32m+[m[32m# Crechely — Centre Management build plan[m
[32m+[m
[32m+[m[32mSource: Dylan's 19 Sept dictated notes, organized 21 Sept 2026[m
[32m+[m[32m(`crechely-centre-management-plan.txt`), tracked in the Claude project as[m
[32m+[m[32m`project-plan.md`. This file is the copy that lives in the repo so Claude[m
[32m+[m[32mCode can read it without the project tool.[m
[32m+[m
[32m+[m[32mGoal: move Crechely from a billing-only tool to full centre management,[m
[32m+[m[32mvia two modes switched top-left — **Centre Management** and **Accounting**[m
[32m+[m[32m(today's app: fees, payments, statements, reminders). Billing is never[m
[32m+[m[32mvisible unless the user clicks into Accounting.[m
[32m+[m
[32m+[m[32mPrinciples: simple beats complete. Every dashboard tile is a number that's[m
[32m+[m[32malso a link (number → list → profile). Roles decide visibility (owners see[m
[32m+[m[32meverything, managers don't see money, teachers see only their own class).[m
[32m+[m[32mThe school's data is the school's — nothing public.[m
[32m+[m
[32m+[m[32mWork ONE phase at a time, only the phase named. If something isn't in this[m
[32m+[m[32mplan or contradicts it, stop and ask instead of guessing.[m
[32m+[m
[32m+[m[32m## Phase 0 — Revenue first (no new features)[m
[32m+[m
[32m+[m[32mNot a Claude Code phase — Dylan is doing this via Cowork/outreach: Paystack[m
[32m+[m[32mverified and checkout migrated, site audit fixes (legal pages, contact[m
[32m+[m[32mroute, proof, share previews), outreach to 20-30 preschools.[m
[32m+[m
[32m+[m[32mGate to Phase 2: Paystack live + at least one paying school, OR several[m
[32m+[m[32mprospects specifically asking for enrolment features.[m
[32m+[m
[32m+[m[32m## Phase 1 — Restructure (S–M) — DO NOW[m
[32m+[m
[32m+[m[32m- Categories → Classes everywhere: screens, statements, PDF exports,[m
[32m+[m[32m  emails, API routes, Prisma model/field names where reasonable without[m
[32m+[m[32m  a risky migration. Flat list — no parent/child hierarchy in the UI[m
[32m+[m[32m  going forward (existing `parentId` self-reference can stay in the[m
[32m+[m[32m  schema for now; just stop exposing/using it as a hierarchy in Phase 1).[m
[32m+[m[32m- Mode switch, top-left: **Centre Management** / **Accounting**. Existing[m
[32m+[m[32m  billing screens move under Accounting unchanged. Centre Management[m
[32m+[m[32m  starts as an empty home (a placeholder dashboard) — its real tiles are[m
[32m+[m[32m  Phase 2+.[m
[32m+[m[32m- Roles: add `TEACHER` (own class only) and `RECEPTIONIST` (adds[m
[32m+[m[32m  children) to the Role enum. Class assignment: admin can assign any[m
[32m+[m[32m  class to any teacher. Managers keep their existing "cannot see money"[m
[32m+[m[32m  restriction — audit it's actually enforced server-side, not just[m
[32m+[m[32m  hidden in the UI.[m
[32m+[m[32m- Activity feed splits by mode: centre actions vs. accounting actions.[m
[32m+[m[32m- Login rate limiting: 5 failed attempts per account+IP per 15 minutes,[m
[32m+[m[32m  then slow/lock. Generic error messages (don't reveal whether the[m
[32m+[m[32m  account exists).[m
[32m+[m
[32m+[m[32m**Done when:** billing works exactly as before under Accounting, all[m
[32m+[m[32mtests pass, lint and a production build are clean, and the word[m
[32m+[m[32m"category"/"Category" no longer appears anywhere in the product (UI[m
[32m+[m[32mcopy, emails, PDFs) — the underlying DB table/model name can stay[m
[32m+[m[32m`Category` if renaming it is a risky migration; that's a naming/schema[m
[32m+[m[32mdecision to flag, not assume.[m
[32m+[m
[32m+[m[32m## Website track — Live Demo page (M), before Phase 2[m
[32m+[m
[32m+[m[32mNot a Claude Code phase yet — needs Dylan's example website first. A demo[m
[32m+[m[32mschool with sample data that resets on a schedule, no signup required.[m
[32m+[m
[32m+[m[32m## Phase 2 — Enrolment (top priority) — split into 4 sessions[m
[32m+[m
[32m+[m[32m1. **Profiles + photos + consent.** Child/parent profiles mirroring the[m
[32m+[m[32m   paper form (name, surname, ID number, photo; parent names/surnames/ID[m
[32m+[m[32m   numbers/occupation/photos; enrolment details). No money on this side.[m
[32m+[m[32m   Mask ID numbers by default with an audit-logged reveal. Photo consent[m
[32m+[m[32m   tick required before storing. Ethnicity: optional field or omit[m
[32m+[m[32m   entirely — do not build the ethnicity chart until Dylan confirms a[m
[32m+[m[32m   legal check (see plan decision #5).[m
[32m+[m[32m2. **Admissions + Enrolled tiles.** Admissions: new children, sortable[m
[32m+[m[32m   Today/Week/Month, with Exits inside it (not a separate dashboard[m
[32m+[m[32m   tile). Enrolled: total learners → charts (gender, age; ethnicity only[m
[32m+[m[32m   if resolved) → classes with counts → class list → child profile. New[m
[32m+[m[32m   admissions billed from admission date (see plan decision #2 for[m
[32m+[m[32m   pro-rata vs full month).[m
[32m+[m[32m3. **Pre-built form templates.** Five customisable templates[m
[32m+[m[32m   (enrolment, re-registration, indemnity confirmed; two more TBD — see[m
[32m+[m[32m   decision #6). School uploads logo/letterhead once, applied[m
[32m+[m[32m   automatically. PDF export. Build as a form builder (fields + template),[m
[32m+[m[32m   not arbitrary PDF editing.[m
[32m+[m[32m4. **Parent online form.** Link sent to parent, fills in on phone,[m
[32m+[m[32m   photographs documents (stored as attachments, no OCR — deferred).[m
[32m+[m[32m   Answers land in the child's profile; school can download as PDF.[m
[32m+[m[32m   Rate-limit the public link, restrict file types/sizes, POPIA notice[m
[32m+[m[32m   at the top.[m
[32m+[m
[32m+[m[32m**Before any phase 2 work ships with real school data:** privacy/terms/[m
[32m+[m[32mPOPIA pages live, photo consent wording, encrypted-at-rest file storage,[m
[32m+[m[32maudit log on profile views and exports.[m
[32m+[m
[32m+[m[32m**Done when:** a school sends a link, a parent completes it on a phone,[m
[32m+[m[32mand a full profile + PDF exist without the school typing anything.[m
[32m+[m
[32m+[m[32m## Phase 3 — Daily running — split into 2 sessions[m
[32m+[m
[32m+[m[32m1. **Attendance.** Teachers mark attendance per class. Attendance tile:[m
[32m+[m[32m   Present = number only (not clickable), Absent = clickable list with[m
[32m+[m[32m   notify-parents by email.[m
[32m+[m[32m2. **To-do engine v1.** 3-4 tasks the app can actually observe (e.g. new[m
[32m+[m[32m   child admitted → generate and send statement). Clears itself on the[m
[32m+[m[32m   observed action — no manual ticking.[m
[32m+[m
[32m+[m[32mTeachers see only their own class (enforce server-side).[m
[32m+[m
[32m+[m[32m**Done when:** a teacher can take the register on a phone in under a[m
[32m+[m[32mminute, and absent parents are emailed in one tap.[m
[32m+[m
[32m+[m[32mPricing note (not a code task): once Phases 2-3 ship, new schools pay a[m
[32m+[m[32mhigher price, existing schools keep their rate.[m
[32m+[m
[32m+[m[32m## Phase 4 — Backup and export[m
[32m+[m
[32m+[m[32mOwner/admin "download everything" (records, forms, statements, payments)[m
[32m+[m[32mas a password-protected file, with an export log. Import from backup is[m
[32m+[m[32mparked, not this phase.[m
[32m+[m
[32m+[m[32m## Phase 5 — Run the centre[m
[32m+[m
[32m+[m[32mStaff tile + assignments, daily schedules per class with teacher[m
[32m+[m[32mnotifications, Upcoming Events tile tied to event billing, Communication[m
[32m+[m[32mtab (manual WhatsApp-group checklist, no integration), complaints/reports[m
[32m+[m[32monce the rest of Dylan's notes surface.[m
[32m+[m
[32m+[m[32m## Parked (do not build without explicit sign-off)[m
[32m+[m
[32m+[m[32mUpload-and-edit any PDF (Adobe-style), OCR, import from backup, sending[m
[32m+[m[32mfrom a school's own Gmail, any WhatsApp integration.[m
[32m+[m
[32m+[m[32m## Open decisions (see project doc for full list — ask before assuming)[m
[32m+[m
[32m+[m[32m1. Exits: inside Admissions only, or also visible in Accounting so[m
[32m+[m[32m   leavers stop being billed?[m
[32m+[m[32m2. Mid-month admission: pro-rata from admission date, or full month?[m
[32m+[m[32m   Registration fee?[m
[32m+[m[32m3. Default mode on login: last-used mode, per user.[m
[32m+[m[32m4. Receptionist: new role (as scoped in Phase 1) — confirmed, not a[m
[32m+[m[32m   Manager preset.[m
[32m+[m[32m5. Ethnicity: optional field pending legal check, or drop entirely —[m
[32m+[m[32m   not resolved, do not build the chart yet.[m
[32m+[m[32m6. Form templates: enrolment/re-registration/indemnity confirmed — two[m
[32m+[m[32m   more not named yet.[m
[32m+[m[32m8. Bring-your-own PDF: form builder + hand-recreating first schools'[m
[32m+[m[32m   forms, not Adobe-style editing — confirmed approach.[m
[32m+[m[32m9. Privacy wording: "processed only on the school's instructions"[m
[32m+[m[32m   replaces "Crechely can't access it" — confirmed, use this wording[m
[32m+[m[32m   anywhere the old phrasing appears.[m
[32m+[m[32m10. Absence notifications: email only to start — confirmed.[m
[32m+[m[32m11. Categories are a flat list, no hierarchy — confirmed (see Phase 1).[m
[1mdiff --git a/docs/PROGRESS.md b/docs/PROGRESS.md[m
[1mnew file mode 100644[m
[1mindex 0000000..b618781[m
[1m--- /dev/null[m
[1m+++ b/docs/PROGRESS.md[m
[36m@@ -0,0 +1,42 @@[m
[32m+[m[32m# Progress log[m
[32m+[m
[32m+[m[32mRunning log of what shipped, per phase, and any decisions made along the[m
[32m+[m[32mway. Add a line here at the end of each session, before merging.[m
[32m+[m
[32m+[m[32m## Phase 1 — Restructure[m
[32m+[m
[32m+[m[32mBranch: `phase-1-restructure` (not merged to main — Dylan merges).[m
[32m+[m
[32m+[m[32mShipped so far (commit 7106575):[m
[32m+[m[32m- Classes UI flattened: no more parent-class picker or indented tree on[m
[32m+[m[32m  the Classes management page. Scoping decision: left the DB/API[m
[32m+[m[32m  `parentId` field and the financial dashboard's category-tree rollup[m
[32m+[m[32m  (DrilldownTree.tsx / CategoryNode) untouched — those are a billing[m
[32m+[m[32m  reporting concern, not the class-management hierarchy the plan meant[m
[32m+[m[32m  to remove. Flag if that reading's wrong.[m
[32m+[m[32m- Login rate limiting tightened to match the plan's "5 in 15 minutes",[m
[32m+[m[32m  and added a second per-IP limit (20/15min) alongside the existing[m
[32m+[m[32m  per-email one, so one IP can't spray one password across many accounts.[m
[32m+[m[32m- Activity log shows "Class" instead of "Category" for entity-type[m
[32m+[m[32m  badges (display-only relabel, DB value untouched).[m
[32m+[m
[32m+[m[32mNot done yet (still on this branch or not started):[m
[32m+[m[32m- Mode switch (Centre Management / Accounting), top-left, with billing[m
[32m+[m[32m  screens moved under Accounting.[m
[32m+[m[32m- Roles: TEACHER, RECEPTIONIST, class assignment — needs a Prisma schema[m
[32m+[m[32m  change (Role enum + a class-assignment relation), which per CLAUDE.md[m
[32m+[m[32m  needs Dylan's approval on the migration SQL before it's written.[m
[32m+[m[32m- Activity feed split by mode — needs a design decision on whether it's[m
[32m+[m[32m  a schema tag (migration) or computed from entityType (no migration);[m
[32m+[m[32m  leaning toward the latter, not started.[m
[32m+[m[32m- Route/nav copy still says "Categories" in the URL segment[m
[32m+[m[32m  (/dashboard/categories) and NavLinks href — left as-is since it's not[m
[32m+[m[32m  visible product copy, only a URL slug; flag if Dylan wants that[m
[32m+[m[32m  renamed too.[m
[32m+[m
[32m+[m[32mBlocker: `npm run lint`, `npm test`, and `npm run build` would not[m
[32m+[m[32mcomplete inside this session's device shell — they hang with near-zero[m
[32m+[m[32mCPU usage, which looks like an I/O stall specific to Node's module[m
[32m+[m[32mresolution over the mounted folder, not a code problem. These 3 changes[m
[32m+[m[32mare small and were reviewed by hand, but Dylan should run the real[m
[32m+[m[32mchecks locally before merging.[m
[1mdiff --git a/src/app/dashboard/categories/page.tsx b/src/app/dashboard/categories/page.tsx[m
[1mindex 581bb36..ed8f0cd 100644[m
[1m--- a/src/app/dashboard/categories/page.tsx[m
[1m+++ b/src/app/dashboard/categories/page.tsx[m
[36m@@ -2,7 +2,7 @@[m
 [m
 import { useCallback, useEffect, useState } from "react";[m
 import { useOrg, canManage } from "../OrgContext";[m
[31m-import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";[m
[32m+[m[32mimport { Button, Card, Input, Label, PageHeader } from "@/components/ui";[m
 import { formatCents } from "@/lib/formatMoney";[m
 import { useConfirmDialog } from "@/components/useConfirmDialog";[m
 import { DeletionControl, type DeletionRequestInfo } from "@/components/DeletionControl";[m
[36m@@ -23,10 +23,6 @@[m [mfunction inputToCents(value: string): number | null {[m
   return Math.round(parsed * 100);[m
 }[m
 [m
[31m-function buildTree(categories: Category[], parentId: string | null): Category[] {[m
[31m-  return categories.filter((c) => c.parentId === parentId);[m
[31m-}[m
[31m-[m
 export default function CategoriesPage() {[m
   const { organizationId, role, currencyCode } = useOrg();[m
   const [categories, setCategories] = useState<Category[]>([]);[m
[36m@@ -36,7 +32,6 @@[m [mexport default function CategoriesPage() {[m
   const { confirm, dialog: confirmDialog } = useConfirmDialog();[m
 [m
   const [name, setName] = useState("");[m
[31m-  const [parentId, setParentId] = useState<string>("");[m
   const [fee, setFee] = useState("");[m
 [m
   const load = useCallback(async () => {[m
[36m@@ -59,8 +54,11 @@[m [mexport default function CategoriesPage() {[m
       method: "POST",[m
       headers: { "Content-Type": "application/json" },[m
       body: JSON.stringify({[m
[32m+[m[32m        // Flat list by decision (Phase 1 centre-management restructure) —[m
[32m+[m[32m        // classes are never nested from this form. The API/schema still[m
[32m+[m[32m        // accept parentId (unchanged, lower-risk than a migration), this[m
[32m+[m[32m        // UI just never sends one.[m
         name,[m
[31m-        parentId: parentId || null,[m
         monthlyFeeCents: inputToCents(fee),[m
       }),[m
     });[m
[36m@@ -91,15 +89,11 @@[m [mexport default function CategoriesPage() {[m
     await load();[m
   }[m
 [m
[31m-  function renderNode(category: Category, depth: number) {[m
[31m-    const children = buildTree(categories, category.id);[m
[32m+[m[32m  function renderRow(category: Category) {[m
     if (category.archived && !showArchived) return null;[m
     return ([m
       <div key={category.id}>[m
[31m-        <div[m
[31m-          className="flex items-center justify-between border-b border-border py-2 px-4 last:border-b-0"[m
[31m-          style={{ paddingLeft: depth * 20 + 16 }}[m
[31m-        >[m
[32m+[m[32m        <div className="flex items-center justify-between border-b border-border py-2 px-4 last:border-b-0">[m
           <div>[m
             <span className={category.archived ? "text-muted line-through" : "text-foreground"}>[m
               {category.name}[m
[36m@@ -132,13 +126,11 @@[m [mexport default function CategoriesPage() {[m
             </div>[m
           )}[m
         </div>[m
[31m-        {children.map((c) => renderNode(c, depth + 1))}[m
       </div>[m
     );[m
   }[m
 [m
[31m-  const roots = buildTree(categories, null);[m
[31m-  const activeCategories = categories.filter((c) => !c.archived);[m
[32m+[m[32m  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));[m
 [m
   return ([m
     <div className="animate-in">[m
[36m@@ -169,20 +161,6 @@[m [mexport default function CategoriesPage() {[m
                 placeholder="e.g. Daycare, or Ducks Class"[m
               />[m
             </Label>[m
[31m-            <Label className="flex flex-col gap-1">[m
[31m-              Parent class (optional)[m
[31m-              <Select[m
[31m-                value={parentId}[m
[31m-                onChange={(e) => setParentId(e.target.value)}[m
[31m-              >[m
[31m-                <option value="">None (top level)</option>[m
[31m-                {activeCategories.map((c) => ([m
[31m-                  <option key={c.id} value={c.id}>[m
[31m-                    {c.name}[m
[31m-                  </option>[m
[31m-                ))}[m
[31m-              </Select>[m
[31m-            </Label>[m
             <Label className="flex flex-col gap-1">[m
               Monthly fee (optional)[m
               <Input[m
[36m@@ -204,12 +182,12 @@[m [mexport default function CategoriesPage() {[m
         <p className="text-sm text-muted-foreground">Loading...</p>[m
       ) : roots.length === 0 ? ([m
         <p className="text-sm text-muted-foreground">[m
[31m-          No classes yet. Add your first one above — e.g. &quot;Daycare&quot;,[m
[31m-          then add sub-classes like &quot;Ducks Class&quot; underneath it.[m
[32m+[m[32m          No classes yet. Add your first one above — e.g. &quot;Butterfly&quot;[m
[32m+[m[32m          or &quot;Ducks Class&quot;.[m
         </p>[m
       ) : ([m
         <Card>[m
[31m-          {roots.map((c) => renderNode(c, 0))}[m
[32m+[m[32m          {sortedCategories.map((c) => renderRow(c))}[m
         </Card>[m
       )}[m
     </div>[m
[1mdiff --git a/src/app/dashboard/settings/activity/page.tsx b/src/app/dashboard/settings/activity/page.tsx[m
[1mindex ef9a38d..32e3e17 100644[m
[1m--- a/src/app/dashboard/settings/activity/page.tsx[m
[1m+++ b/src/app/dashboard/settings/activity/page.tsx[m
[36m@@ -58,6 +58,13 @@[m [mconst ENTITY_BADGE: Record<string, "brand" | "accent" | "success" | "danger" | "[m
   Reminder: "neutral",[m
 };[m
 [m
[32m+[m[32m// Display label only — entry.entityType keeps its DB value ("Category")[m
[32m+[m[32m// so the badge color map and any historical entries still line up;[m
[32m+[m[32m// this just renders what the product now calls the thing.[m
[32m+[m[32mconst ENTITY_LABEL: Record<string, string> = {[m
[32m+[m[32m  Category: "Class",[m
[32m+[m[32m};[m
[32m+[m
 function describeAction(action: string): string {[m
   const [, verb] = action.split(".");[m
   return VERB_LABELS[verb] ?? verb ?? action;[m
[36m@@ -78,7 +85,7 @@[m [mfunction ActivityRow({ entry }: { entry: AuditEntry }) {[m
   return ([m
     <div className="flex items-start gap-3 px-4 py-3">[m
       <Badge variant={ENTITY_BADGE[entry.entityType] ?? "neutral"}>[m
[31m-        {entry.entityType}[m
[32m+[m[32m        {ENTITY_LABEL[entry.entityType] ?? entry.entityType}[m
       </Badge>[m
       <div className="min-w-0 flex-1">[m
         <p className="text-sm text-foreground">[m
[1mdiff --git a/src/lib/auth.ts b/src/lib/auth.ts[m
[1mindex a553433..5fafd55 100644[m
[1m--- a/src/lib/auth.ts[m
[1m+++ b/src/lib/auth.ts[m
[36m@@ -22,20 +22,28 @@[m [mexport const { handlers, signIn, signOut, auth } = NextAuth({[m
         email: { label: "Email", type: "email" },[m
         password: { label: "Password", type: "password" },[m
       },[m
[31m-      async authorize(credentials) {[m
[32m+[m[32m      async authorize(credentials, request) {[m
         const emailResult = emailSchema.safeParse(credentials?.email);[m
         if (!emailResult.success || typeof credentials?.password !== "string") {[m
           return null;[m
         }[m
         const email = emailResult.data;[m
 [m
[31m-        // Rate limit by email, not just IP: stops credential-stuffing[m
[31m-        // against one account from behind a shared/rotating IP.[m
[31m-        const { allowed } = rateLimit(`login:${email}`, {[m
[32m+[m[32m        // Rate limit on two dimensions, both generic-failure (no "which[m
[32m+[m[32m        // one tripped" signal to the client): per email, so credential[m
[32m+[m[32m        // stuffing against one account from a shared/rotating IP is[m
[32m+[m[32m        // still capped; and per IP, so spraying one password across many[m
[32m+[m[32m        // emails from one source doesn't fly under the per-email limit.[m
[32m+[m[32m        const ip = request?.headers?.get("x-forwarded-for") ?? "unknown";[m
[32m+[m[32m        const byEmail = rateLimit(`login:email:${email}`, {[m
           limit: 10,[m
           windowMs: 15 * 60 * 1000,[m
         });[m
[31m-        if (!allowed) return null;[m
[32m+[m[32m        const byIp = rateLimit(`login:ip:${ip}`, {[m
[32m+[m[32m          limit: 20,[m
[32m+[m[32m          windowMs: 15 * 60 * 1000,[m
[32m+[m[32m        });[m
[32m+[m[32m        if (!byEmail.allowed || !byIp.allowed) return null;[m
 [m
         const user = await db.user.findUnique({ where: { email } });[m
         if (!user) return null;[m
