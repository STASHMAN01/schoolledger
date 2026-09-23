# Things only you can do

This is a running list of the handful of steps that need you personally —
a credential, a purchase, a decision on an account you own. Everything
else (code, features, design, polish) I'm handling without you. I'll keep
this file updated as things get added or checked off; you don't need to
do anything on this list unless/until you're ready to.

## 1. Email sending for "forgot password" and "Send all reminders" (pending)

Right now, password-reset requests work but the email doesn't actually
send — it's just logged quietly on the server. The new "Send all
reminders" button on the Reminders page (bulk-emails every parent with
an outstanding balance, once two admins/accountants approve it) uses
the exact same email setup, so it's also silently a no-op until you do
this — the approval flow works, it just won't actually land in anyone's
inbox yet. One setup step turns both on. To turn on real email sending:

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

## 3. Payment processor — decision made: Paystack (not Stripe)

Only needed once you're ready to actually charge people — right now the
billing pages/plan selection won't process real payments.

**Decided 2026-09-16**: we're going with **Paystack**, not Stripe.
Reason: Stripe doesn't actually support South African merchant payouts
directly — SA businesses get routed through Paystack anyway (Stripe owns
Paystack), so there's no direct-Stripe option to begin with. Comparing
the real SA options (Paystack vs. PayFast vs. Yoco), Paystack has the
lowest card fee (2.9% + R1), a genuinely cheap EFT rate (~2% via
Capitec Pay/Ozow — useful since parents likely pay by EFT a lot), no
monthly fee, and the best API/docs quality of the three. Full comparison
is in `TINYLEDGER-MONEY-RESEARCH.md` if you want the details.

When you're ready to start charging (not before — no reason to set this
up earlier), the code in this app will need to be switched from its
current Stripe-shaped billing code to Paystack's API — that's on me once
you say go. Steps on your side:

1. Create/verify a Paystack account (paystack.com — South Africa is a
   directly supported market).
2. In Paystack, set up two **Plan** objects: one recurring monthly at
   $50 (or R-equivalent — Paystack settles in ZAR), one recurring yearly
   at $450.
3. In Vercel, add:
   - `PAYSTACK_SECRET_KEY`
   - `PAYSTACK_WEBHOOK_SECRET` (or the equivalent Paystack gives you for
     verifying webhook signatures — I'll give you the exact endpoint URL
     when this step comes up)
   - `PAYSTACK_PLAN_CODE_MONTHLY`
   - `PAYSTACK_PLAN_CODE_YEARLY`

I'll walk you through this step by step when you say you're ready —
it's the same "I can't type in a live secret key for you" situation as
#1.

## 4. Real support email (whenever you're ready)

There's now a Support page (linked from the top of both the marketing
site and the dashboard) with a "How to use TinyLedger" guide and a
contact email. Right now that email is a placeholder —
`support@tinyledger.app` — which doesn't go anywhere real yet. When
you've decided what address you want customers writing to (could just
be your own Gmail for now), tell me and I'll swap the one line in
`src/lib/support.ts` — no account setup needed on your end for this one,
just tell me the address.

---

_Last updated: 2026-09-16 (payment processor decided: Paystack, not Stripe).
Nothing above is urgent — the app works fully
without any of it (trial signups, all features, the platform dashboard).
These are just the specific moments where a human with account access
has to be the one to click "confirm," or a decision only you can make._
