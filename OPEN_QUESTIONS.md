# Open questions — things only Dylan can answer

Everything below is a real gap found during the audit that code can't
close on its own. Grouped by what's blocking.

## Blocking a real launch

1. **WhatsApp number.** `src/lib/support.ts` has `WHATSAPP_NUMBER = ""`.
   The site currently shows "WhatsApp us (number coming soon)" instead
   of a link. Format needed: country code, no spaces/plus, e.g.
   `27821234567` for 082 123 4567. This is referenced in three places
   (footer, homepage, pricing) — fixing the one constant fixes all three.

2. **Founder section (C4).** The homepage now has a real section with
   visible `[ADD REAL: …]` placeholders for: your name, a short honest
   paragraph on why you built Crechely and the real preschool it was
   built for, and your city/region. A photo slot is there too if you
   want one — optional, but photos measurably help trust on an
   otherwise-anonymous SaaS site.

3. **Lawyer review of the three legal documents.** `PRIVACY_POLICY.md`,
   `TERMS_OF_SERVICE.md`, and the new `POPIA_NOTICE.md` are drafts —
   every `[FILL IN]`/`[DECIDE]` bracket in them needs an actual decision
   plus a lawyer's sign-off before you onboard a real school with real
   children's data. Specific decisions only you can make:
   - Your registered business name (currently `[YOUR REGISTERED
     BUSINESS NAME]` throughout).
   - Data retention period after cancellation (a placeholder "30-90
     days" is suggested but not decided).
   - Which region Vercel/Render actually store data in, for the POPIA
     cross-border question.
   - Who your (or Crechely's) information officer is — a POPIA
     requirement, currently a placeholder in `POPIA_NOTICE.md`.

4. **VAT treatment on the pricing page.** I wrote "Crechely is not
   currently VAT-registered, so no VAT is added" as a placeholder
   default — I don't actually know your VAT registration status. If
   that's wrong, it's a live, published claim about pricing that needs
   correcting immediately (`src/app/pricing/page.tsx`).

## Real screenshots (C5)

The homepage's product panel is now honestly captioned as an example
with sample data, but the brief also asked for real screenshots of the
dashboard, the reminders page, and an actual statement, plus a
downloadable sample statement PDF. I don't have a login to your own
account (and per the standing security rule, I won't ask you to give me
one, or enter credentials myself) — so I couldn't capture these. Two
ways to close this:
- You log in, take the screenshots yourself (desktop width, a
  realistic-looking demo org — not your real customers' data if you
  have any test/demo org set up), and send them to me to place on the
  site.
- Or tell me it's fine to create a throwaway demo organisation through
  the public `/register` flow (no real data), and I'll populate it with
  realistic sample data and screenshot that instead.

## Copy/product decisions flagged, not made unilaterally

5. **M1 — the headline "Accounting built for preschools."** Flagged as
   fighting the page's own "not general ledgers" positioning, and
   possibly intimidating to a non-accountant crèche owner. I did **not**
   change it (per the brief). Three alternatives to consider:
   - "Fee tracking, built for preschools" — plainest, matches what the
     product actually does today.
   - "Know who's paid, in one place" — outcome-led, echoes the
     homepage's actual H1 wording already.
   - "The fee book that never loses track" — leans into replacing the
     notebook/spreadsheet, which is the real competitor for most
     prospects right now, not other software.

6. **M4 — the register page's country dropdown** (South Africa,
   Zimbabwe, US, UK). The brief suggested revisiting this for a
   SA-focused pitch, but cutting options is a product decision with real
   trade-offs (a Zimbabwean or UK prospect could still want to sign up),
   not a copy fix — left as-is pending your call.

## Verify, don't just trust

7. **apex vs. www.** `crechely.co.za` and `www.crechely.co.za` appeared
   to behave as two separate, non-redirecting origins when checked live
   from a browser (a cross-origin fetch between them failed with a CORS
   error, which shouldn't happen if one redirected to the other). This
   is a DNS/Vercel domain-settings question, not app code — worth a
   quick check in Vercel's domain settings to confirm one redirects to
   the other. Search engines and link-preview tools can otherwise treat
   the two as duplicate, competing pages.

8. **CrecheSpots pricing** — their site (`crechespots.co.za`) didn't
   load during this audit (navigation was refused/failed twice). Their
   pricing in `PRICING_RECOMMENDATION.md` is carried over from the
   earlier project research, not re-verified live today — flagged so it
   isn't mistaken for freshly confirmed.

## Scope not attempted this pass (M6/M7/M8)

Mobile tap-target/accessibility audit (M6), Core Web Vitals measurement
(M7), and structured-data/analytics verification (M8) need either a
live PageSpeed Insights run or a full manual pass at 375px on a live
deployment — better done against the actual deployed preview of this
branch than guessed at from source code. Flagging as the next chunk of
work once this branch is reviewed and (if you're happy with it) pushed
somewhere Dylan can preview it.
