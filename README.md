# SchoolLedger (working name)

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

## Setting up billing (Stripe)

1. In the Stripe Dashboard (test mode is fine for development), create a
   Product with two Prices: one recurring monthly (~$50), one recurring
   yearly (~$350-450). Copy each Price's id into `STRIPE_PRICE_ID_MONTHLY`
   / `STRIPE_PRICE_ID_YEARLY` in `.env.local`.
2. Copy your test secret key into `STRIPE_SECRET_KEY`.
3. For local webhook testing, install the [Stripe CLI](https://docs.stripe.com/stripe-cli)
   and run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   — it prints a webhook signing secret, put that in `STRIPE_WEBHOOK_SECRET`.
   Never accept unsigned webhook requests as a shortcut, even in
   development — `stripe listen` signs them correctly, so there's no need
   to.
4. In production, add a webhook endpoint in the Stripe Dashboard pointing
   at `https://<your-domain>/api/webhooks/stripe`, subscribed at minimum to
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted` — then use *that* endpoint's signing
   secret (not the CLI's) as `STRIPE_WEBHOOK_SECRET` in production.

## Deploying

Vercel (frontend + API routes) + a managed Postgres provider (Neon or
Supabase both have generous free tiers to start) is the path of least
resistance for a solo founder. Set every value from `.env.example` as real
environment variables in the hosting platform's dashboard — never commit
them.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · Prisma + Postgres ·
Auth.js (NextAuth v5) · Stripe (billing, Phase 4) · Zod (validation).
