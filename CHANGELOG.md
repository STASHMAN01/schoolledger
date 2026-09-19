# Changelog — launch-readiness audit pass

## 2026-09-19 (reminders email fallback)

- **Added a "Copy email address" fallback next to the Reminders page's
  Email button.** The Email button itself was already correct — a plain
  `mailto:` link — but `mailto:` links fail completely silently (no
  error, nothing visible) on any device with no default mail app
  configured, which is what Dylan was hitting. Rather than depending on
  every user's device being configured correctly, there's now a second
  button that copies just the parent's email address so it can be
  pasted into Gmail/webmail/whatever mail client someone actually uses.

## 2026-09-19 (trial length)

- **Extended the free trial from 14 to 30 days.** 14 days never spans one
  full monthly billing cycle, so nobody trialing the product experienced
  the automated month-end statement/reminder run — the actual moment
  that shows what Crechely does. New `src/lib/trial.ts` (`TRIAL_DAYS =
  30`) is now the single source of truth; it was previously hardcoded
  independently in 8 places (the register route's actual
  `trialEndsAt` calculation, plus marketing copy on the homepage,
  `/register`, and `/pricing`), which is exactly the kind of thing that
  drifts out of sync. This was Dylan's call, not analysis-only — he
  asked for it directly after reviewing a pricing-strategy write-up that
  flagged the short trial as the single highest-leverage change in it.

## 2026-09-19 (dashboard/homepage follow-ups)

Branch: `feature/dashboard-and-pricing-tweaks`. Not yet merged to `main`.

- **Dark mode was defaulting on for some visitors.** `ThemeToggle.tsx`
  fell back to `matchMedia("(prefers-color-scheme: dark)")` whenever
  nothing was saved to `localStorage`, and `globals.css` had a matching
  `@media (prefers-color-scheme: dark)` block. Anyone with a dark-mode OS
  saw a dark site on first visit. Removed both — the default is now
  always light for every visitor; dark only applies once someone
  explicitly clicks the toggle.
- **"Add child" is now collapsed by default.** The form on
  `/dashboard/children` was an always-open Card at the top of the page;
  it's now a closed dropdown ("Add child" button with a chevron) that
  opens on click and has its own Cancel button, closing again after a
  successful add.
- **"Categories" renamed to "Classes" in every visible label**, since
  the product is now scoped entirely to crèches/preschools rather than
  a general school hierarchy — nav link, page titles, form labels,
  filters, CSV import template/column/errors, support-page copy. The
  underlying `Category` Prisma model, API routes (`/api/organizations/
  [id]/categories`), and the `/dashboard/categories` URL were
  deliberately left unchanged — renaming those would mean a real schema
  migration and broken bookmarks/integrations for a purely cosmetic win.
- **Homepage founder section filled in** with Dylan's real name and a
  summarized version of his story (Bela-Bela, family crèche since 2015,
  11 years in the industry, why he built this). Founder photo is still
  a placeholder — none was provided.
- **Testimonials: removed the empty placeholder slots, added a real
  submission + moderation flow.** New `Testimonial` model (`PENDING` /
  `APPROVED` / `REJECTED`), a public, unauthenticated submission form at
  `/testimonials/new` (rate-limited, honeypot field), and a
  platform-admin-only moderation queue at `/platform/testimonials`
  (gated by the existing `requirePlatformAdmin`, i.e.
  `dylanmaps3@gmail.com` via `PLATFORM_ADMIN_EMAILS`, same as the rest
  of `/platform`). The homepage now queries only `APPROVED` testimonials
  server-side and shows an honest "be the first to share yours" prompt
  when there are none — never a fake or auto-published quote.
  **Requires a schema change on the production database** — see the
  note at the end of this entry.
- **Reminders "Email" button investigated, not changed.** The button is
  a plain `mailto:` link built from the parent's real email and the
  reminder message — the code is correct. The most likely cause of
  "nothing happens" is that the device/browser has no default email
  application configured, which is a common, silent failure mode for
  `mailto:` links (no error, no dialog, nothing visibly happens). Not a
  code fix; flagged for Dylan to check on his own machine/browser.

**Before this branch's DB-dependent parts work in production**: run
`npx prisma generate && npx prisma db push` against the live database
(no `prisma/migrations` folder exists in this repo — every prior schema
change was applied the same way, via `db push`, not `migrate`). Without
this, `/testimonials/new`, `/platform/testimonials`, and the homepage's
testimonial section will error, since the `testimonials` table won't
exist yet.

## 2026-09-19 (post-deploy fix)

- **Bug found live**, right after this branch deployed to production:
  `src/components/LegalDoc.tsx`'s markdown renderer only merged wrapped
  *paragraph* lines, not wrapped *list item* lines. Several bullets in
  `/privacy` and `/terms` are written across multiple source lines
  (standard markdown — a list item wraps until a blank line), and each
  continuation line was being rendered as a new, orphaned paragraph
  instead of staying part of its bullet — visibly mangling the "who this
  data is about" bullets on the live `/privacy` page. Fixed by tracking
  the currently-open list item the same way the paragraph buffer already
  worked, so a continuation line joins the open bullet instead of
  starting a stray paragraph. Verified against the exact live output
  that showed the bug.

Branch: `audit/crechely-launch-readiness`. All entries below reference the
issue IDs in `CRECHELY_AUDIT.md`. Nothing in this branch has been pushed
or merged to `main` — per the brief, that's Dylan's call.

## 2026-09-19

### Critical

- **C1** — Replaced every stray "T"/"C" letter-badge with the real logo
  (icon and full lockup), now that the logo file exists. Found in more
  places than the brief flagged: the footer (as reported), plus
  `/login`, `/forgot-password`, `/register`, `/reset-password`, and
  — most visible of all — the literal browser-tab favicon
  (`src/app/favicon.ico` was a teal "T" icon). Generated from the
  source logo: `icon.png`/`favicon.ico`/`apple-icon.png` (Next.js
  auto-wires these by file convention), a one-colour navy icon variant,
  a white-wordmark variant for dark backgrounds, a horizontal
  icon+wordmark lockup, and a 1200×630 social share image. New
  `src/components/Logo.tsx` is the single place every usage now points
  to. Also repointed the site's colour tokens (`globals.css`) at the
  logo's real colours — see M5 below for the contrast work that
  required.
- **C2** — Published Privacy Policy, Terms of Service, and a new POPIA
  Notice as real pages (`/privacy`, `/terms`, `/popia`), linked from the
  footer and the register form. They already existed as drafts in
  `legal/` from an earlier session but were never reachable from the
  live site — a visitor genuinely had no way to find them before this.
  Filled in the subprocessors that are actually known (Vercel, Render,
  Zoho Mail) and corrected a stale reference to Stripe (the actual plan
  is Paystack — Stripe doesn't support direct South African payouts).
  Added a short "how we handle your data" summary to the top of the
  privacy policy. Every page carries a visible DRAFT banner — publishing
  them makes the draft honestly visible, it does not mean they're
  lawyer-reviewed. **Do not treat these as finished; a lawyer still
  needs to review all three before onboarding real customers.**
- **C3** — `/support` (relabelled "Contact") is now linked from the
  footer, not just the header. Footer has a real `mailto:` link and a
  WhatsApp click-to-chat link — the WhatsApp number itself is not yet
  set (`[ADD REAL: WhatsApp number]` in `src/lib/support.ts`), so the
  site shows a visible "coming soon" label instead of a dead or fake
  link. Pricing page's promised "real person to email" now actually
  shows the address.
- **C4** — Added an honest founder/trust section to the homepage: photo
  slot, name/story placeholders, contact details, and three empty
  testimonial slots. Nothing invented — every gap is marked
  `[ADD REAL: …]` and logged in `OPEN_QUESTIONS.md`.
- **C5** — The homepage's sample-statement panel was captioned "One
  real statement... not a mockup," which wasn't true (the names in it —
  Naledi M., Thabo K., Amahle N. — are made up). Recaptioned it
  honestly as an example with sample data. Real dashboard screenshots
  are still blocked — see `OPEN_QUESTIONS.md`.
- **C6** — Added Open Graph and Twitter Card metadata site-wide
  (`metadataBase`, per-page title/description, `opengraph-image.png`,
  `twitter-image.png`, canonical tags via `alternates.canonical`).
  Before this, `crechely.co.za` links previewed as bare text in
  WhatsApp/Slack/etc. — confirmed live, there were no `og:*` or
  `twitter:*` tags on any page.

### High

- **H1** — Every page had the identical `<title>`/description (verified
  live on `/` and `/pricing`). Added unique metadata to `/`, `/pricing`,
  `/register` (via a new `layout.tsx`, since the page itself is a client
  component), `/login`, `/support`.
- **H2** — Added a low-commitment secondary CTA (WhatsApp when a number
  exists, otherwise "email us for a sample statement") on the homepage
  hero, after the benefits section, and on `/pricing`.
- **H3** — Standardised every CTA on "Start free trial" (was "Start free
  trial" / "Start your free trial" in different spots). Relabelled
  "Compare plans →" to "See pricing →" — confirmed there's nothing to
  compare, it's one plan.
- **H4** — Checked live: the benefits (Features) section already flows
  directly into the price+CTA closing section with no gap between them.
  No change needed — noting this so it isn't re-flagged as still broken.
- **H5** — Pricing page rebuilt as one card with monthly/yearly shown
  side by side (not two separate plan cards). Added an explicit VAT
  line (flagged as an assumption pending Dylan's confirmation — see
  `OPEN_QUESTIONS.md`). Fixed "almost 2 months free" → it's exactly 2
  months (R499 × 12 = R5,988; R5,988 − R4,990 = R998 = 2 × R499).
  Dropped the trailing ".00" on prices. Added a 30-day money-back
  guarantee on the annual plan. Standardised the value framing sitewide
  on "one paying family a month covers it" (the homepage's closing
  section already used this line — pricing page previously used a
  different "one term of one child's fees" framing; now consistent).
- **H6** — Pricing page no longer repeats the homepage's feature list.
  Replaced with direct answers to five real objections: day-15 behaviour,
  data retention, cancellation, export before leaving, refund terms.
- **H7** — Added an 8-question FAQ to `/pricing` covering setup time,
  importing existing records, data on cancellation, POPIA, staff
  visibility, mobile use, "can parents pay" (no), and how reminders
  reach families (email).
- **H8** — Added plain product-truth statements on both the homepage
  and `/pricing`: Crechely *records* payments, it doesn't collect them;
  reminders are email-only.
- **H9** — Register form: dropped the confirm-password field (the
  existing show/hide toggle on the password field already covers the
  "did I typo it" case confirm-password exists for). Added a required
  Terms/Privacy checkbox with real links, the real support email inline
  (was a bare "email us"), a logo linking home, and a "what happens
  next" line after signup.
- **H10** — Investigated: fetched `/login`'s rendered text directly
  (not a screenshot) and the full form content (email/password fields,
  "Welcome back," etc.) was present — this did **not** reproduce as
  empty-to-a-crawler. Noting this as unconfirmed/possibly stale rather
  than claiming it's fixed; see `CRECHELY_AUDIT.md` H10 for the exact
  verification.

### Beyond the brief (found during verification, not in the original list)

- Fixed `src/middleware.ts`: `/robots.txt` and `/sitemap.xml` (neither
  existed before this pass) were being silently redirected to `/login`
  by the auth middleware, same as any unmatched URL — confirmed live.
  Added both, plus Next's generated icon/OG routes, to the middleware's
  public-path list, and created `src/app/robots.ts` +
  `src/app/sitemap.ts` (neither existed).
- `text-accent` in the child detail page's `PARTIALLY_PAID` status
  colour was safe under the old amber accent but fails WCAG AA now that
  `--accent` is the logo's yellow — fixed to use the soft-foreground
  token that's actually designed to be read as text (M5).
- Observed (not fixed — flagged for Dylan, see `OPEN_QUESTIONS.md`):
  `crechely.co.za` and `www.crechely.co.za` appear to behave as
  non-redirecting, separate origins when checked live from a browser —
  worth a DNS/Vercel domain-settings check.

### M-series (spelling, design tokens, mobile/perf/SEO)

- **M3** — "Invite your mom, your accountant, or a teacher" →
  "Invite your bookkeeper, your accountant, or a teacher."
- **M2** (partial) — "enrollment(s)" → "enrolment(s)" on the five
  audited public pages (`/`, `/pricing`, root metadata). A full sweep of
  the in-app dashboard copy was out of scope for this pass — flagged in
  `OPEN_QUESTIONS.md`.
- **M4** — The old pricing page's "works in your currency" line is gone
  (removed along with the rest of that page's old bullet list in the H5
  rebuild). Register page's multi-country dropdown left as-is —
  removing it is a product decision, not a copy fix; flagged for Dylan
  in `CRECHELY_AUDIT.md`.
- **M5** — Rebuilt the colour tokens in `globals.css` from the real
  logo (sky blue, yellow, navy) instead of the placeholder teal/amber
  that was there before any logo existed. Computed and documented WCAG
  contrast ratios for every brand/accent pairing — see
  `BEFORE_AFTER.md`. The literal logo blue (#089ef7) fails AA with white
  text (2.9:1), so the interactive/button blue is a darkened derivative
  (#0670b8, 5.23:1) while the true logo blue is kept for tints/badges
  behind dark text.
- **M1, M6, M7, M8** — Not done in this pass; see `OPEN_QUESTIONS.md`
  and `CRECHELY_AUDIT.md` for why and what's needed to close them.

### Pricing — analysis only, nothing live changed

- **PRICING_RECOMMENDATION.md** written with live-verified competitor
  pricing (Koonection confirmed R499/month flat with a fuller feature
  set than Crechely, live-checked today; Creche Cloud pricing is
  demo-gated, not public; CrecheSpots' site did not load during this
  audit — flagged as unverified rather than guessed). The live price
  (R499/month) was **not changed** — every number in that doc is marked
  PROPOSED, per the brief.
