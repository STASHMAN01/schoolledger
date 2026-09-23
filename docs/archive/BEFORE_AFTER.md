# Before / after

**No PageSpeed/Lighthouse re-run is included.** This environment has no
PageSpeed Insights tool, and running one meaningfully needs a real
deployed URL for this branch (localhost/sandbox builds don't reflect
real network conditions for a mobile-data buyer). What follows instead
is what's concretely, verifiably different: exact copy/structure
before-and-after, and computed WCAG contrast ratios for the new colour
palette (M5) — a real, checkable number, unlike a guessed performance
score.

## Colour tokens: before → after, with contrast ratios

The palette was placeholder teal/amber (chosen before the logo existed)
and is now derived from the real logo (sky blue #089ef7 circle, yellow
#fed503 duck, navy #002159 wordmark).

| Token | Before | After | Why |
|---|---|---|---|
| `--brand` (buttons/links) | `#0f766e` (teal) | `#0670b8` | Darkened from the logo's literal sky blue (`#089ef7`) — the literal blue fails AA with white text (see table below) |
| `--brand-foreground` (button text) | `#ffffff` | `#ffffff` | Unchanged — now passes AA against the new `--brand` |
| `--brand-soft` (tints/badges) | `#ecfdf9` | `#e6f4ff` | Light tint of the *true* logo blue — safe here because it sits behind dark text, not white |
| `--accent` | `#d97706` (amber) | `#fed503` (logo yellow) | Direct from the logo |
| `--accent-foreground` (new token) | — | `#002159` | Added per the brief: "yellow buttons get navy text, never white" |

### WCAG contrast ratios (computed, light mode)

| Pairing | Ratio | AA normal text (4.5:1) | AA large text/UI (3:1) |
|---|---|---|---|
| White text on literal logo blue `#089ef7` | **2.9:1** | ❌ Fail | ❌ Fail (barely) |
| White text on new `--brand` `#0670b8` | **5.23:1** | ✅ Pass | ✅ Pass |
| Navy `#002159` text on literal logo blue `#089ef7` | 5.32:1 | ✅ Pass | ✅ Pass |
| Navy `#002159` text on logo yellow `#fed503` | **10.82:1** | ✅ Pass | ✅ Pass |
| White text on navy `#002159` | 15.42:1 | ✅ Pass | ✅ Pass |

**Dark mode** brand token (`#38bdf8`, a lighter sky blue) against the
dark-mode navy background text colour (`#001233`): **8.64:1** — pass.

### Regression caught by this check

`src/app/dashboard/children/[childId]/page.tsx` had a `text-accent`
usage (the "partially paid" status label) that was fine under the old
amber accent but would have silently failed AA once `--accent` became
bright yellow. Fixed to use `text-accent-soft-foreground` instead, which
is the token actually designed to be legible as text. This is exactly
the kind of thing a "swap one token" change can quietly break — worth
grepping for `text-accent\b` again after any future palette change.

## Copy: before → after

| Location | Before | After |
|---|---|---|
| Homepage/pricing CTA | "Start your free trial" / "Start free trial" (inconsistent) | "Start free trial" everywhere |
| Homepage closing link | "Compare plans →" | "See pricing →" |
| Pricing headline | "Less than one term of one child's fees. Covers your whole school." | "One paying family a month covers your whole school." (matches the homepage's own framing, which previously disagreed with this page) |
| Pricing yearly savings | "Saves R998 — almost 2 months free" | "Saves R998 — exactly 2 months free" (R499 × 12 = R5,988; R5,988 − R4,990 = R998 = 2 × R499, confirmed) |
| Pricing amounts | "R499.00" / "R4,990.00" | "R499" / "R4,990" |
| Homepage statement caption | "One real statement, generated from what was actually recorded — not a mockup." (false — the data shown is fictional) | "An example of the statement layout — shown with sample data, not a real school's." |
| `<title>` on every page | Identical: "Crechely — Accounting built for preschools" | Unique per page (e.g. `/pricing` → "Pricing \| Crechely") |
| Footer logo mark | Stray "T" (TinyLedger leftover) | Real duck icon |
| Browser tab favicon | Teal "T" square | Real duck icon |
| Register form | 6 fields incl. confirm-password; no terms link; "email us" with no address | 5 fields (dropped confirm-password); required terms/privacy checkbox; real email shown |

## Structural: before → after

| Item | Before | After |
|---|---|---|
| `/robots.txt` | Redirected to `/login` (live-confirmed) | Serves real rules via `src/app/robots.ts` |
| `/sitemap.xml` | Redirected to `/login` (live-confirmed) | Serves 8 public routes via `src/app/sitemap.ts` |
| `og:*` / `twitter:*` tags | None on any page (live-confirmed via `document.querySelector`) | Present site-wide, per-page override on `/`, `/pricing`, `/register`, `/login`, `/support` |
| `/privacy`, `/terms`, `/popia` | Did not exist as routes (drafts sat unused in `legal/`) | Live routes, DRAFT-banner, linked from footer + register |
| Apple touch icon | Missing | `src/app/apple-icon.png` (Next auto-wires it) |

## What "score" actually changed vs. what's unverified

Concretely verifiable in this document: contrast ratios (computed,
reproducible), exact copy diffs (grepped from source), and structural
fixes (live-confirmed before, source-confirmed after). Not verifiable
without a live deployment of this branch: Lighthouse/PageSpeed
before/after, real link-preview rendering in WhatsApp, and a real mobile
device pass — all flagged in `OPEN_QUESTIONS.md` as the next step once
this branch has somewhere to actually be previewed.
