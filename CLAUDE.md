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
- One branch per phase. Commit small. NEVER push or merge to main; I do
  that.
- Before saying a phase is done: run `npm run test`, `npm run lint` and
  `npm run build`, and show me the output.
- Database changes: show me the migration SQL and wait for approval. Use
  the local dev database only. Never use production credentials and never
  edit .env files.
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
