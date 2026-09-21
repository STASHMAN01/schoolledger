@AGENTS.md

# Crechely
Next.js (App Router, TypeScript) + Postgres (Prisma) SaaS for preschool
centre management, currently billing-only in production (fees, payments,
statements, reminders). No paying customers yet.

# Plan
- The build plan is docs/PLAN.md. Work on ONE phase at a time, only the
  phase I name.
- After each phase, add what shipped and any decisions to docs/PROGRESS.md.
- If something isn't in the plan or contradicts it, stop and ask.

# Workflow
- Updated 2026-09-21, replaces the earlier "never push/merge" rule:
  local verification (lint/test/build) was too slow/manual for Dylan
  to keep running. New flow: build the full phase, merge and push to
  main directly (main deploys straight to crechely.co.za via Vercel --
  no staging buffer), then do a joint bug-hunt pass against the live
  site afterward instead of checking before every merge.
- Still commit small, still one branch per phase, so there's a real
  diff to look at and a revert point if something's wrong.
- After merging, check the Vercel deployment (build status/logs) before
  calling it done -- that's the one automated check standing in for the
  local build step.
- EXCEPTION, still requires stopping and asking first: any database
  migration. Show Dylan the migration SQL and wait for approval before
  running it -- a bad migration can lose data in a way a bad UI change
  can't, so this one stays gated regardless of the rest of this policy.
  Never use production credentials directly; never edit .env files.
- Payments: Paystack, not Stripe. Don't touch the billing checkout unless
  the task says so.

# Product rules
- Crechely records payments; it does not collect them. Reminders are
  email only. No WhatsApp integration.
- South African English (enrolment, maths). Prices in rand, no cents on
  marketing pages.
- Children's data is sensitive (POPIA): no real names, ID numbers or
  photos in tests, fixtures or logs. Mask ID numbers in the UI by
  default. No ethnicity field/chart unless the plan says the legal check
  is resolved.
- Never invent testimonials, statistics, customer counts or compliance
  claims in copy.
