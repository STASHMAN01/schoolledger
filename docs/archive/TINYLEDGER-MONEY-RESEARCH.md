# TinyLedger — Money & Infrastructure Research
*Prepared 2026-09-16. Not legal or financial advice — pricing/fees can change; confirm at checkout/signup before committing.*

## 1. Days left on the free platforms

Two separate clocks, both real:

- **Render free Postgres database**: expires **26 days from now (2026-10-12)**. After that there's a **14-day grace period** where upgrading to a paid plan still saves your data — but if you let the grace period lapse too, the data is **permanently deleted**. This is the one that actually threatens losing customer data, so it's the one to act on first.
- **Demo/trial orgs' own 14-day trial**: ends 2026-09-27 (11 days) — this is just your in-app trial logic, not a hosting deadline, and much less urgent.

**Bottom line: you have about 26 days before you need a paid Postgres plan, or 40 days before data loss becomes possible.** Render's cheapest paid Postgres tier is $6/month (more in the table below).

## 2. Can anyone anywhere use the app as-is?

Yes. I checked the actual code — there's no country/IP geo-blocking anywhere in the app. The only place an IP address is used at all is for anti-abuse rate limiting (e.g. throttling repeated failed logins), not for restricting access by location. Anyone in the world can sign up and use TinyLedger today.

## 3. What you'd need to pay before your first 100 clients

**The most urgent finding in this whole research batch, so I'm putting it first:** Vercel's free "Hobby" plan is officially, contractually restricted to **"non-commercial, personal use only"** per Vercel's own terms (https://vercel.com/docs/plans/hobby). TinyLedger is a paid commercial SaaS. Running it on Hobby isn't just a performance risk — it's a terms-of-service violation that Vercel could act on (suspend the project) at any time, independent of how much traffic you get. This is worth fixing before scaling regardless of client count.

Costs to plan for:

| Service | Free tier | First paid tier | What it gets you |
|---|---|---|---|
| Vercel | Hobby (non-commercial only) | **Pro: $20/month per seat** | Commercial use allowed, higher limits, team seats |
| Render Postgres | Free (expires, see #1) | **$6/mo** → $19/mo → $40/mo → $100/mo | More storage/RAM as you scale; $6/mo tier is plenty to start |

For 100 clients (meaning 100 preschool organizations, each with their own staff/children/payments — not 100 total users), realistic early-stage costs are:
- Vercel Pro: $20/month (1 seat is enough until you add teammates)
- Render Postgres: $6–19/month depending on data volume
- **Total: roughly $26–39/month (~R470–R720/month at current exchange rates)** to run commercially and comfortably before 100 clients. This should not get slow or unresponsive at that scale — 100 small orgs is a light workload for either tier.

## 4. Domain research (Namecheap, GoDaddy, others)

**tinyledger.com is already taken** — it's parked and listed for sale at a fixed price of **$14,888**. Not worth buying at that price for a bootstrapped product.

Alternatives and real pricing:

| Registrar | TLD | First year | Renewal | Notes |
|---|---|---|---|---|
| Namecheap | .com | ~$6.98–$9 (promo pricing varies) | ~$15–17/yr | Free WHOIS privacy for life, no major upsell traps |
| Namecheap | .app | ~$12–17 first year (varies) | similar | Requires HTTPS (built into browsers) — fine for a web app |
| Namecheap | .co | $19.98 (promo, 48% off) | **$45.48/yr** | Big jump from first-year price to renewal — factor this in before choosing |
| GoDaddy | .com | $9.99 | $21.99 | **WHOIS privacy is a paid add-on ($9.99/yr)** unlike Namecheap where it's free; watch for upsells at checkout — SSL certs pushed at $79.99/yr you don't need (Vercel gives you free SSL automatically); real total first-year bills of $150+ are a known complaint if you don't decline every upsell |

**Recommendation**: since tinyledger.com isn't realistically available, go with **tinyledger.app** or a clearly-branded alternative (e.g. tinyledgerapp.com, gettinyledger.com) through **Namecheap** — cheapest honest pricing, free privacy protection, no aggressive upsells at checkout. Avoid .co unless you're fine with the ~$45/yr renewal. Budget roughly **$15–20/year** ongoing for whichever you pick.

## 5. Other expenses — email for reminders/notifications

Right now the app sends email via Gmail SMTP with an app password (free, no-ops gracefully if unset).

| Option | Free limit | Paid | Notes |
|---|---|---|---|
| Gmail SMTP (current setup) | 500 emails/day | — | Fine for early scale; risk of Google flagging/rate-limiting if volume spikes suddenly |
| Google Workspace SMTP | 2,000 emails/day | ~$7/user/month (Workspace subscription) | Higher limit, plus gives you a proper @tinyledger.xyz email address (see #7) |
| Resend (transactional email API) | 100 emails/day free | $20/month for 50,000/month | Built for exactly this use case (reminders/receipts), more reliable deliverability than personal Gmail SMTP at scale |

**What this actually costs you right now**: nothing — you're well under Gmail's 500/day free limit at your current scale. **What it'll cost you later**: once you're sending more than ~500 reminder emails/day (which would mean a few hundred active preschool orgs each sending reminders), moving to Resend at $20/month is the natural upgrade — it's built for transactional email and won't risk your personal Gmail account getting flagged for spam-like sending patterns.

## 6. Gmail-as-a-connector for auto-importing EFT payments

This is the least "clean yes" of the 8 questions. A few honest options, roughly in order of effort:

- **What you already have (near-term, works today)**: TinyLedger already has a CSV bulk-import feature for payments. If your bank (or your clients' banks) can export a CSV/statement of EFT transactions, that's already a working path to avoid manual one-by-one entry — no new engineering needed.
- **Gmail API + email parsing (moderate effort, medium reliability)**: Many South African banks send email notifications for EFT deposits. It's technically possible to build a Gmail API integration that watches an inbox, parses those notification emails for amount/reference, and creates a matching payment record in TinyLedger automatically. This is buildable, but it's fragile — it depends on each bank's email format staying consistent, and it only works if the relevant bank notifications land in a Gmail inbox you control (not each individual client's own bank).
- **South African bank-API / open-banking platforms (more robust, but a separate integration)**: Two real leads worth exploring further if this becomes a priority: **Stitch** (SA embedded-finance/open-banking API platform) and **Ozow's** newer bank-API payment rails (FNB/RMB). These are built specifically to give apps like TinyLedger real-time, structured payment data instead of scraping email — but integrating either is a proper scoped feature (auth, webhook handling, reconciliation logic), not a quick add-on.

**My honest read**: don't build the Gmail-parsing integration first — it's the most fragile of the three options for the least reliability gain. If manual entry is the real pain point, either (a) lean harder on the CSV import you already have, or (b) treat a Stitch/Ozow-style bank-API integration as a proper future feature once you have enough paying clients to justify the engineering time.

## 7. Custom email domain cost (support@tinyledger.xyz instead of a Gmail address)

Yes, this is possible and not expensive, but it does cost something — you can't get a working @yourdomain.com inbox for free indefinitely:

| Option | Free tier | Paid | Notes |
|---|---|---|---|
| Zoho Mail | 5 users, 5 custom addresses, 1 domain — free | Paid tiers start low if you outgrow 5 addresses | Cheapest real option; enough for support@, hello@, billing@ etc. on one domain |
| Google Workspace | No free tier | Starts ~$7/user/month | More expensive but integrates with Gmail/Calendar/Drive you may already use, and raises your sending limit (see #5) |

**Recommendation**: once you have your own domain, **Zoho Mail's free tier** gets you support@tinyledger.xyz (or whatever domain you pick) at no extra cost, which fully answers this question — you don't need to pay Google unless you specifically want Workspace's other tools.

## 8. Best payment processor (South Africa)

**Important correction to flag**: Stripe does **not** directly support South African merchant payouts — Stripe's own global-availability page lists South Africa under "Extended network," meaning South African businesses are routed through **Paystack** (which Stripe owns) rather than getting a direct Stripe account. So "just use Stripe" isn't actually available to you as a South African business — this is worth revisiting in your Stripe setup notes.

Real SA options compared:

| Processor | Card fee | EFT fee | Monthly fee | Setup fee | Notes |
|---|---|---|---|---|---|
| **Paystack** | 2.9% + R1 | ~2% (via Capitec Pay/Ozow) | None | None | Owned by Stripe; well-documented API; good developer experience |
| **PayFast** | 3.2% + R2 | 2.0% | None | None | Various payout fee structures depending on payout speed |
| **Yoco** (online gateway) | 2.95% + R2 (Core), 2.80% + R2 (Pro) | Not clearly offered as a separate low-cost EFT rail | None (Core), R249–R499/mo (Plus/Pro) | None | Primarily known for in-person card readers; online gateway fees are card-only and slightly higher than Paystack for cards, with no clear cheap EFT option |

**Recommendation stands as before: Paystack.** It has the lowest card fee, a genuinely cheap EFT option (~2%, useful since preschool parents likely pay by EFT often), no monthly fee, and — since it's Stripe-owned — the best documentation/API quality of the three. PayFast is a reasonable second choice if you ever hit friction with Paystack's onboarding. Yoco is the weakest fit for TinyLedger specifically since it's built more around in-person card payments than a SaaS billing flow.

---

## Suggested next step (not asked, but flagged)

`TINYLEDGER-TODO-FOR-DYLAN.md` currently has a Stripe setup item. Given the finding in #8 above, that item should probably be updated to point at Paystack instead, since Stripe isn't directly usable for South African payouts. I haven't changed it yet — wanted you to see the reasoning first since it's a real pivot to the billing plan, not a small tweak.
