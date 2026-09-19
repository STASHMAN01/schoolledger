# Crechely launch-readiness audit

Branch: `audit/crechely-launch-readiness`. Verified against the live site
at `crechely.co.za` / `www.crechely.co.za` and the repo source
(`STASHMAN01/schoolledger`) on 2026-09-19, plus the deployed source for
anything not independently checkable from a browser (SSR/middleware
behaviour, exact copy strings).

**A note on evidence.** The brief asked for screenshots into
`/audit/screenshots`. What I actually have is more precise for most of
these findings: live page text/DOM extraction (`get_page_text`, direct
JS `document.querySelector` reads) and source-code line references,
which confirm exact copy and structural bugs (like the middleware
redirect) more reliably than a screenshot would. I did not capture image
screenshots this pass — flagged in `OPEN_QUESTIONS.md` if you want visual
screenshots specifically. Every finding below states what was actually
checked and how.

## Phase 0 — verification summary

| Check | Result |
|---|---|
| `/`, `/pricing`, `/register`, `/login`, `/support` reachable | Yes, all live |
| `robots.txt` | **Missing**, and the URL redirected to `/login` (see Beyond-the-brief-1) — fixed |
| `sitemap.xml` | **Missing**, same redirect bug — fixed |
| favicon | Present but was a leftover teal "T" (TinyLedger) — fixed |
| apple-touch-icon | **Missing** — added |
| `<head>` meta (title/description/OG/canonical) | Title/description present but identical on every page; no OG/Twitter/canonical tags at all — fixed |
| Console errors | One observed: a CORS failure fetching `crechely.co.za` from a page loaded at `www.crechely.co.za` — see Beyond-the-brief-2 |
| PageSpeed Insights (mobile) | **Not run** — no PageSpeed tool available in this environment; flagged in `OPEN_QUESTIONS.md` as needing a live deployed-preview run (M7) |
| 1440/768/375px viewports | Not independently re-verified visually this pass (no way to screenshot my own local changes before they're deployed) — the existing responsive Tailwind classes were left as-is except where new content was added, using the same patterns as the surrounding page |

## Critical

### C1 — Stray letter-mark logo

**Confirmed, and worse than reported.** The brief named the footer. Live
+ source verification found the same placeholder in **six** places:
footer, `/login`, `/forgot-password`, `/register`, `/reset-password`,
and — the most visible of all — the actual browser-tab favicon
(`src/app/favicon.ico` was a solid teal square with a "T", confirmed via
`file` on the binary and the SVG source it was generated from).

**Fixed.** All six now use the real logo via a new `src/components/Logo.tsx`.
Generated from your uploaded file: transparent icon PNG (multiple sizes
+ `.ico`), apple-touch-icon, a one-colour navy icon variant, a white-
wordmark variant for dark backgrounds, a horizontal icon+wordmark
lockup, and a 1200×630 OG share image. See `public/brand/` for all of
them and `brand-source/logo-source.png` for your original file.

### C2 — No privacy policy / terms / POPIA notice

**Confirmed as reported for the live site** — nothing was linked or
reachable. What I found in the repo, though: a previous session had
already drafted a full `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md`
under `legal/`, both already correctly marked DRAFT — they'd just never
been turned into pages or linked anywhere, so a visitor had no way to
find them. **Fixed**: published as `/privacy`, `/terms`, and a new
`/popia` (POPIA_NOTICE.md, written this pass), all linked from the
footer and the register form, all still carrying a visible DRAFT banner.
Filled in real known facts (Vercel/Render/Zoho as subprocessors,
corrected a stale "Stripe" reference to the actual plan, Paystack) and
added the short "how we handle your data" summary. **Not done**: lawyer
review, and the business-specific placeholders only you can fill in —
full list in `OPEN_QUESTIONS.md`.

### C3 — /support unreachable, no real contact info

**Confirmed for the parts still open.** The header already linked
`/support` (fixed in an earlier session, per the repo's own commit
history), but the **footer did not**, and the pricing page's "a real
person to email" line showed no address. **Fixed**: footer now links
Contact, shows the real `support@crechely.co.za` as a mailto link, and
has a WhatsApp click-to-chat slot. **Not done**: the WhatsApp number
itself — you said you'd add it, it wasn't in your message, so the site
currently shows an honest "coming soon" label instead of a broken or
fake link. See `OPEN_QUESTIONS.md` item 1.

### C4 — No proof/trust signals

**Confirmed.** Added a founder/trust section to the homepage: photo
slot, name/story/location placeholders (all marked `[ADD REAL: …]`),
real contact details, and three empty testimonial slots. Nothing
invented. **Not done**: the actual content, since it's yours to write —
see `OPEN_QUESTIONS.md` item 2.

### C5 — No real product screenshots; unverifiable claim

**Confirmed, and found an additional problem beyond "no screenshots":**
the existing statement panel was captioned "One real statement,
generated from what was actually recorded — not a mockup," but the
names in it (Naledi M., Thabo K., Amahle N.) are fabricated example data,
not a real school's. That caption was false as written. **Fixed the
claim**: recaptioned as "An example of the statement layout — shown with
sample data, not a real school's." **Not done**: actual dashboard/
reminders-page screenshots and a downloadable sample PDF — I don't have
login access to your account and won't ask for or use your credentials
(standing rule). See `OPEN_QUESTIONS.md` item on real screenshots for
two ways to close this.

### C6 — No Open Graph / Twitter tags

**Confirmed live** — fetched `document.querySelector('meta[property="og:image"]')`
etc. directly from the rendered homepage; none were present, only a
plain description tag. **Fixed**: `metadataBase`, per-page OG/Twitter
title+description, and Next's file-convention `opengraph-image.png` /
`twitter-image.png` (auto-wired to every page's `<head>`) using the new
logo lockup. **Not independently tested** in an actual WhatsApp preview
(would need the branch deployed somewhere reachable) — worth a real
check once this is live on a preview URL.

## High

- **H1 — confirmed live.** Fetched `/` and `/pricing`'s rendered
  `<title>` directly; both were byte-identical
  ("Crechely — Accounting built for preschools"), confirming the site
  had one shared title/description for every page. Fixed for `/`,
  `/pricing`, `/register`, `/login`, `/support`.
- **H2 — confirmed, fixed.** Added a secondary low-commitment CTA in
  three places (hero, after benefits, pricing).
- **H3 — confirmed live** ("Start your free trial" on the hero vs.
  "Start free trial" on the pricing cards and footer, "Compare plans →"
  when there's nothing to compare). Standardised.
- **H4 — checked, not actually broken.** Live text extraction confirms
  the Features section flows directly into the price+CTA closing
  section already. No code change made; noting so this isn't re-flagged.
- **H5 — confirmed live**, including the exact math: pricing page showed
  "R499.00" / "R4,990.00" / "almost 2 months free" verbatim. Rebuilt as
  one card, fixed the math wording (it's exactly 2 months, not
  "almost"), dropped `.00`, added a money-back guarantee, unified the
  value framing. VAT line added but flagged as an unconfirmed assumption
  — see `OPEN_QUESTIONS.md` item 4.
- **H6 — confirmed live**, pricing page's "What you stop having to do
  yourself" list was near-identical in structure/tone to the homepage's
  feature list. Replaced with 5 direct objection-answers.
- **H7 — confirmed absent live.** Added an 8-question FAQ.
- **H8 — confirmed absent.** Added plain "records, doesn't collect" /
  "email-only reminders" copy on both `/` and `/pricing`.
- **H9 — confirmed** (6 fields including confirm-password, no terms
  link, bare "email us" with no address). Fixed: dropped confirm-
  password (redundant with the existing show/hide toggle), added a
  required terms/privacy checkbox, real support email inline, logo
  linking home, "what happens next" line.
- **H10 — investigated, could not reproduce.** Live-fetched `/login`'s
  rendered text directly (not via a browser screenshot, which wouldn't
  show what a non-JS crawler sees anyway) — full form content ("Welcome
  back", email/password labels, the "No account yet?" line) was present
  in the response. This may have been fixed already by whatever set
  `PUBLIC_PATHS` up, or the original finding may have been about
  something more specific (a particular crawler's JS handling, or a
  transient build). Not marking this "fixed" since I can't confirm what
  was originally broken — flagging as unconfirmed rather than claiming
  a fix for a bug I couldn't reproduce.

## Beyond the brief (found during this audit, not in the original list)

1. **Middleware redirected `/robots.txt` and `/sitemap.xml` to `/login`.**
   Live-confirmed: navigating to either URL landed on the login page.
   Root cause: `src/middleware.ts`'s `PUBLIC_PATHS` allowlist redirects
   *any* unmatched path to `/login` for an unauthenticated visitor —
   which is reasonable for real app routes, but silently swallowed
   crawler/SEO files (and would do the same to any mistyped URL, which
   gets a soft-redirect to login instead of a real 404 — noted but not
   changed, since fixing that properly needs the middleware to know
   which routes genuinely exist vs. don't, a bigger change than this
   pass). Fixed for the specific known SEO/asset paths.
2. **apex vs. www may not redirect to each other.** A JS `fetch()` from
   a page loaded at `www.crechely.co.za` to `crechely.co.za` failed with
   a CORS error — that only happens if the two are actually separate,
   non-redirecting origins. This is a DNS/Vercel setting, not app code —
   flagged in `OPEN_QUESTIONS.md` rather than touched, per "ask before
   touching DNS."
3. **`text-accent` contrast regression risk from the M5 palette change**
   — see M5 below.

## Medium

- **M1 — not changed, 3 alternatives proposed** in `OPEN_QUESTIONS.md`
  per your explicit sign-off requirement.
- **M2 — partial.** "enrollment(s)" → "enrolment(s)" fixed on the 5
  audited public pages. A full in-app spelling/grammar sweep (the
  dashboard itself, which crèche staff use daily) was not attempted —
  meaningfully larger scope, flagged as follow-up.
- **M3 — done**, one-line copy fix.
- **M4 — partial.** The old pricing page's currency-mention bullet is
  gone (removed along with that whole list in the H5 rebuild). The
  register page's 4-country dropdown was left as-is — flagged as a
  product decision, not a copy fix.
- **M5 — done, with a real finding.** Rebuilt the colour tokens from
  the actual logo (sky blue / yellow / navy) — see `BEFORE_AFTER.md` for
  the full before/after token table and WCAG contrast numbers. The
  literal logo blue fails AA with white button text (2.9:1); the
  button/interactive blue is a darkened derivative of it (5.23:1) so
  buttons stay accessible, with the true logo blue kept for
  backgrounds/tints instead. Also caught and fixed a contrast
  regression the palette swap would otherwise have introduced: a
  `text-accent` usage on the child detail page that was safe under the
  old amber accent color but would have failed AA once accent became
  bright yellow.
- **M6, M7, M8 — not attempted this pass.** These genuinely need a live
  deployed preview to test properly (real Lighthouse/PageSpeed run,
  real touch-target measurement on an actual rendered page, real
  network-tab verification of analytics events) rather than guesswork
  from source. See `OPEN_QUESTIONS.md`.

## What I did not touch, and why

- **Live prices.** R499/month and R4,990/year are unchanged everywhere.
  `PRICING_RECOMMENDATION.md` is analysis only.
- **DNS.** Flagged the apex/www question rather than acting on it.
- **Pushing to `main`.** Everything above is on
  `audit/crechely-launch-readiness`, uncommitted to the shared history
  until you review it.
- **Legal conclusions.** Every compliance-adjacent line (VAT, POPIA
  specifics, data retention) is marked as a draft/assumption, not stated
  as settled fact.

## No exposed keys or credentials found

Checked `.env.example` (placeholders only) and grepped the changed/
touched files for anything resembling a live secret — nothing found.
Not a full repo-wide secret scan; flagging that limitation rather than
implying a complete audit.
