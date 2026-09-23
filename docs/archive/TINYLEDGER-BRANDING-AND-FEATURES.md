# TinyLedger — logo prompt & feature review

## 1. Logo / mascot prompt

No image-generation tool is available in this session, so this is written as a prompt for you to paste into whatever image generator you use (Midjourney, DALL·E, Ideogram, etc.). Duolingo-style branding means: one simple, friendly character that can be reused everywhere (favicon, loading states, empty states, marketing) rather than a generic abstract mark.

Given the app is preschool-focused, an owl reads as "watchful/organized" without being twee — but a duckling, fox, or elephant would all work the same way. Swap the animal word if you want a different one.

> A simple, modern flat vector mascot logo of a small friendly owl character, for a preschool accounting app called "TinyLedger." The owl is round and approachable, sitting upright, holding or looking at a tiny ledger/notebook with a checkmark on it. Bold clean outlines, minimal detail, 2-3 colors max: a warm teal (#0f766e) as the primary color and a soft amber (#d97706) as an accent. Flat design, no gradients, no drop shadows, no photorealism — style similar to Duolingo's owl or Slack's icon: simple enough to read clearly at 32x32px favicon size. Centered composition, transparent or white background, no text in the image.

A few notes so the result is usable, not just cute:

- Ask for a few variations at once and pick the one that still reads clearly shrunk down to favicon size — that's the real test, not how it looks large.
- Once you have a mascot you like, the site's color scheme should follow it (per your note) rather than the other way around — I'd hold off on any further palette changes until you've picked one, then I can pull the exact colors from it and update `globals.css` in one pass instead of guessing now and redoing it later.
- If the generator gives you a background, ask for a transparent-background version too (or I can help strip it) — you'll want it as both a square icon (favicon, app icon) and possibly a wider lockup with "TinyLedger" text next to it for the header.

## 2. What a customer gets for $50/month (or $450/year)

Everything below is a real, shipped feature — not aspirational copy. This is what's actually live on tinyledger today:

**Enrollment & records** — unlimited children and enrollments, organized by category (e.g. class/age group), with parent contact details and enrollment dates tracked per child.

**Billing** — recurring fees (school fees that bill automatically every period) and one-off charges (uniforms, trips, registration) on the same child record, plus dedicated event billing: creating an event (a trip, a fundraiser) auto-generates the one-time charge for every enrolled child in the target group in a single step.

**Payments** — cash, EFT, and card payments logged against a child's balance, applied oldest-outstanding-first so nothing is left half-paid by accident. A full audit log tracks who did what and when.

**Collections** — an automated payment reminders page: one place to see every family with an outstanding balance and send a reminder, with the system tracking who's already been nudged so nobody gets double-messaged (or missed).

**Statements & exports** — clean, printable/sendable statements per child showing what's paid and what's owed, plus CSV export of payment data for a bookkeeper or accountant.

**Multi-currency** — set the school's currency once; every screen, statement, and export follows it. Useful if you're selling to schools outside the US.

**Team access** — invite staff with roles (admin, accountant, manager, viewer) so a bookkeeper can see financials while a classroom manager only sees enrollment, for example.

**Account security** — password reset via email, and now light/dark mode, on both the marketing site and the dashboard.

That's a genuinely complete answer to "how do I track who's paid and who owes what," which is the specific problem TinyLedger solves. It is a billing/accounting tool, full stop — not a general preschool-operations platform.

## 3. What's missing, that clients would likely want

This is based on looking at what a category leader (Brightwheel, the biggest name in this space) offers beyond billing. None of this is required for TinyLedger to be useful today — plenty of small schools would pay just for what's above — but it's worth knowing what a prospect might ask "do you also do X?" about, so you're not caught off guard, and so you can prioritize what to build next based on actual demand rather than guessing.

**Parent communication.** This is the biggest gap. Brightwheel's whole pitch is really "communication app that also bills," and for a lot of preschools that's the feature parents actually see every day — photo/video sharing from the classroom, direct messaging with staff, an event calendar. TinyLedger currently has no parent-facing surface at all; everything is admin-side. If you ever want to expand beyond "back-office billing tool" this is the highest-leverage next feature, because it's what turns a paid admin tool into something parents notice and schools brag about.

**Daily check-in / attendance.** A simple "which kids are here today" tracker (often via a tablet at the door) is table stakes at most competitors, and it's also the natural on-ramp to billing — attendance-based billing rules, half-day vs full-day rates, that kind of thing.

**Daily activity reports.** Digital replacements for the paper "what did my kid do today" sheet (naps, meals, diaper changes, incident reports). This is a bigger build and probably not worth it unless customers specifically ask for it — it's more "daycare operations" than "accounting," and outside what you're currently positioned as.

**Staff scheduling / payroll.** Bigger competitors bundle this in. Likely lower priority for you — it's a different problem domain (HR, not fee tracking) and schools already using something for payroll may not want to switch just for that.

**Curriculum / lesson planning.** Lowest priority of the gaps — this is specific to bigger center chains and state-standards compliance, not the kind of small independent preschool/crèche TinyLedger seems to be targeting.

If I had to rank these by "most likely to actually cost you a sale": parent communication first by a wide margin, attendance/check-in second, and the rest a distant third. Happy to scope out what a minimal version of either would take whenever you want to go there — no rush, just flagging it since you asked what's missing.
