# TinyLedger — Launch Budget
*Prepared 2026-09-16. Not legal or financial advice — figures can change; confirm at checkout/signup before paying.*

This is the concrete "spend this, get this" list to move from where you are now (free platforms, no payment processor connected) to able to sell TinyLedger to real customers.

## One-time costs (pay once, before or at launch)

| Item | Cost | Why |
|---|---|---|
| Domain: tinyledger.app (Namecheap) | ~$15–20 (~R270–360) | Your own branded address instead of `schoolledger-rho.vercel.app`. Renews yearly at roughly the same price — no big jump like `.co` has. |
| **Total one-time** | **~$15–20 (~R270–360)** | |

Nothing else is a one-time cost. Everything below is recurring, and the payment processor takes its cut per-transaction rather than charging you upfront.

## Recurring monthly costs

| Item | Cost/month | Why you need it |
|---|---|---|
| Vercel Pro | $20 (~R360) | Required — the free Hobby tier is officially non-commercial-use-only, so this is the one non-negotiable upgrade before you sell to anyone. Covers hosting, no traffic cap, free SSL. |
| Render Postgres (paid tier) | $6 (~R110) to start | Required before 2026-10-12, when the free database expires. $6/month tier (256MB RAM, 1GB storage) comfortably covers 100 schools' worth of data, logos included — upgrade to $19/month later only if the app starts feeling slow under load. |
| Email sending (Resend) | $0 to start | You're well under the free tier (3,000 emails/month) until you have real client volume. Budget $20/month once you're consistently sending more than ~100 reminder/receipt emails a day across all schools combined. |
| Support email (Zoho Mail) | $0 to start | Free tier covers up to 5 addresses (support@, billing@, etc.) on your domain. No cost unless you need a 6th address. |
| **Total recurring at launch** | **~$26/month (~R470/month)** | Vercel + Render only — email is free at launch-day volume. |
| **Total recurring once you're sending real email volume** | **~$46/month (~R830/month)** | Add Resend's $20/month tier once volume justifies it — not needed on day one. |

## Payment processor: Paystack (no monthly fee)

This isn't a fixed cost — it comes out of each transaction, so it scales with revenue rather than being a bill you have to cover regardless of sales:

- **Cards**: 2.9% + R1 per transaction
- **EFT** (via Capitec Pay/Ozow): ~2% per transaction
- **No monthly fee, no setup fee**

**Good news on getting started**: I checked Paystack's actual requirements, and you do **not** need a registered company to sign up and get paid. As a South African individual/sole proprietor, you can get verified with just:
- Your personal bank account number
- A bank confirmation letter (not older than 6 months)
- Valid government-issued ID (name must match the bank account exactly)

If you later register a formal business (CIPC), Paystack has a separate tier for that with higher limits — but it's not required to start selling.

## What this adds up to

- **Before you can charge your first customer**: domain (~$15–20 once) + Vercel Pro + Render Postgres = **roughly $46–60 total to get everything running for the first month**, then **~$26/month** ongoing after that.
- **Paystack itself costs nothing upfront** — sign-up is free, verification just needs your ID and bank details, and fees only apply once money actually moves.
- At $50/month per client (your target price), **one paying customer covers your entire monthly infrastructure bill** (~$26/month) with room to spare. Break-even is genuinely one client, not one hundred.

## Suggested order of operations

1. Buy the domain (tinyledger.app) and connect it in Vercel.
2. Upgrade Vercel to Pro ($20/month) — needed regardless of client count, for the commercial-use terms alone.
3. Upgrade Render Postgres to the $6/month tier before 2026-10-12 (your free database's expiry) — don't wait until the deadline.
4. Set up Zoho Mail's free tier for support@tinyledger.app.
5. Sign up for Paystack with your personal ID + bank details, complete verification.
6. Once Paystack is verified, tell me and I'll wire the billing code over from its current Stripe-shaped setup to Paystack's API (this part is on me, not a cost to you).
7. Leave email sending on the current free Gmail SMTP / Resend free tier until volume actually requires the $20/month Resend upgrade — no need to pay for that on day one.

Everything above is achievable for **under $60 out of pocket to get the doors open**, then **~$26/month** to keep them open, before a single client payment comes in.
