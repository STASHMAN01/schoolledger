# Crechely

Web SaaS for preschools and small schools to manage categories/classes,
children, payments, statements, and billing. See `PHASES.md` for the build
roadmap and `SECURITY.md` before touching auth, the data model, or
deployment.

## Getting started (local development)

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values:
   - `DATABASE_URL` — a Postgres connection string (a free local one via
     `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16` works
     for development).
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `FIELD_ENCRYPTION_KEY` — generate with `openssl rand -base64 32`.
3. Generate the Prisma client and create the database tables:
   ```
   npx prisma generate
   npx prisma migrate dev --name init
   ```
4. Run the dev server: `npm run dev`, then open http://localhost:3000 and
   use "Set up your school" to create the first account.

## Running tests

`npm test` runs the Vitest suite covering the money and access-control
logic (`src/lib/billing/*.test.ts`) — no database needed, since those
functions are pure. Run it before merging any change to
`src/lib/billing/*` or `src/lib/tenant.ts`. `npm run test:watch` re-runs on
file changes.

## Setting up billing (Paystack)

1. In the Paystack Dashboard (test mode is fine for development, and works
   even before compliance/KYC verification finishes), go to Products >
   Plans and create two Plans: one monthly, one yearly, priced in ZAR.
   Copy each Plan's code into `PAYSTACK_PLAN_CODE_MONTHLY` /
   `PAYSTACK_PLAN_CODE_YEARLY` in `.env.local`.
2. Copy your test secret key into `PAYSTACK_SECRET_KEY`.
3. In the Paystack Dashboard, add a webhook endpoint pointing at
   `https://<your-domain>/api/webhooks/paystack`. Unlike Stripe, Paystack
   doesn't issue a separate webhook signing secret — the same
   `PAYSTACK_SECRET_KEY` is used to verify the `x-paystack-signature`
   header (HMAC-SHA512 of the raw body), so there's nothing extra to copy.
   There is no equivalent of the Stripe CLI's `stripe listen` for local
   testing; use the Paystack Dashboard's "Send test webhook" feature, or a
   tunnel (ngrok, ngrok's tunnel domain registered as the webhook URL) to
   receive real ones locally.
4. At minimum, the app acts on the `charge.success`, `subscription.create`,
   `subscription.disable`, and `invoice.payment_failed` events — make sure
   those are enabled for the webhook endpoint.

## Deploying

Vercel (frontend + API routes) + a managed Postgres provider (Neon or
Supabase both have generous free tiers to start) is the path of least
resistance for a solo founder. Set every value from `.env.example` as real
environment variables in the hosting platform's dashboard — never commit
them.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · Prisma + Postgres ·
Auth.js (NextAuth v5) · Paystack (billing) · Zod (validation).
