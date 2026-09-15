# Things only you can do

This is a running list of the handful of steps that need you personally —
a credential, a purchase, a decision on an account you own. Everything
else (code, features, design, polish) I'm handling without you. I'll keep
this file updated as things get added or checked off; you don't need to
do anything on this list unless/until you're ready to.

## 1. Email sending for "forgot password" (pending)

Right now, password-reset requests work but the email doesn't actually
send — it's just logged quietly on the server. To turn on real email
sending:

1. Go to https://myaccount.google.com/apppasswords (turn on 2-Step
   Verification first if it asks — required for App Passwords).
2. Create an app password named something like "TinyLedger". Google
   shows you a 16-character code — copy it.
3. In Vercel: your project → **Settings → Environment Variables**, add
   (as type **Secret**, for Production):
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_USER` = the Gmail address you used
   - `SMTP_PASS` = the 16-character app password
4. Redeploy (Deployments → latest → Redeploy) so the new variables take
   effect.

_Why I can't do this step myself: it means putting a real credential
into a field, which I'm not able to do even when asked — it has to be
you._

## 2. A real domain for TinyLedger (optional, whenever you're ready)

The app is renamed to **TinyLedger** in the product itself now, but it's
still living at `schoolledger-rho.vercel.app`. That's fine to keep using
for free — but if/when you want a proper domain (e.g. `tinyledger.com`,
`.app`, or `.co`), buying it and connecting it needs your Vercel account
and your card:

1. Buy the domain (Vercel sells domains directly under **Domains** in
   your project, or you can buy elsewhere — e.g. Namecheap — and point
   it at Vercel).
2. Add it in Vercel's project **Settings → Domains**.
3. Once it's live, tell me the new domain and I'll update the
   `NEXTAUTH_URL` environment variable and anywhere the app hardcodes
   its own URL.

No rush on this — search ranking and sharing links both work fine on
the current `.vercel.app` address in the meantime.

## 3. Stripe — only needed once you're ready to actually charge people

Stripe isn't connected in production yet, so right now the billing
pages/plan selection won't process real payments. When you're ready to
start charging (not before — no reason to set this up earlier):

1. Create/verify a Stripe account.
2. In Stripe, create two **Price** objects: one recurring monthly at
   $50, one recurring yearly at $450.
3. In Vercel, add:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (from a Stripe webhook pointed at your
     deployed `/api/webhooks/stripe`-style endpoint — I'll give you the
     exact URL when this step comes up)
   - `STRIPE_PRICE_ID_MONTHLY`
   - `STRIPE_PRICE_ID_YEARLY`

I'll walk you through this step by step when you say you're ready —
it's the same "I can't type in a live secret key for you" situation as
#1.

---

_Last updated: 2026-09-15. Nothing above is urgent — the app works fully
without any of it (trial signups, all features, the platform dashboard).
These are just the specific moments where a human with account access
has to be the one to click "confirm."_
