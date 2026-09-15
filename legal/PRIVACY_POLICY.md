# Privacy Policy — TinyLedger (working name)

**Status: DRAFT — not yet reviewed by a lawyer. Do not publish this or start
onboarding paying customers until a lawyer (ideally one familiar with POPIA,
since the first customers are South African schools) has reviewed it and
the bracketed placeholders below have been filled in with your real
business details.**

_Last updated: [DATE]_

## Who this is about and who we are

This policy explains how **[YOUR REGISTERED BUSINESS NAME]** ("**we**",
"**us**", operating the TinyLedger product, referred to here as "**the
Service**") collects, uses, stores and protects personal information when a
school ("**you**", "**the school**", "**the customer**") uses the Service
to manage its own records of children, parents/guardians, and payments.

Two kinds of people's data pass through the Service, and it's worth being
explicit about the difference:

- **The school's own staff accounts** (admins, accountants, managers,
  viewers) — people who sign up and log in. We are the ones who decide how
  this data is processed, so for this data **we are the "responsible
  party"** under POPIA (or "data controller" under GDPR, if that ever
  applies).
- **The children and parents/guardians the school records in the
  Service** (names, contact details, enrollment dates, payment history) —
  this data belongs to the school's own relationship with those families.
  The school decides what to record and why; we just provide the software
  and the hosting. For this data, **the school is the responsible
  party/controller, and we act as an "operator" (POPIA) / "processor"
  (GDPR)** — we process it only on the school's instructions, for the
  purpose of running the Service.

If you are a parent or family member and have a question about your own or
your child's information held in the Service, please contact **the school
directly** — we don't have a relationship with you and generally can't act
on your data independently of the school that entered it. If you are a
school, this policy is written for you.

Contact for privacy questions: **[SUPPORT/PRIVACY EMAIL ADDRESS]**

## What we collect

### About your school's staff accounts
- Name, email address, and hashed password (we never store or see your
  actual password — see "How we protect this data" below).
- Role within your organization (Admin / Accountant / Manager / Viewer).
- Login activity and an audit trail of actions taken in the Service (see
  "Audit logging" below).

### About the children and families your school records
Entered by your school's own staff, not collected directly from families
by us:
- Child's name, enrollment/exit dates, category/class, fee arrangements.
- Parent/guardian contact details (phone number, email) where your school
  chooses to record them.
- Payment and billing history: amounts due, amounts paid, payment dates,
  receipt records, outstanding balances.
- Bank account details, where your school records them for statement
  purposes — this specific field is encrypted at rest (see below).

### About your school as our customer
- School/organization name, address, banking details for your own
  statements, country and currency settings.
- Billing and subscription information — **card details are never seen or
  stored by us**; payment is handled entirely by our payment processor,
  Stripe (see "Who else sees this data" below).

### Collected automatically
- Standard technical logs (IP address, browser type, timestamps) generated
  by normal web server operation and our hosting provider, for security and
  troubleshooting purposes.

## Why we collect it (purpose / lawful basis)

We only use this data to provide, secure, and improve the Service — never
to sell it, and never to advertise to you or the families your school
serves. Specifically:

- **To operate the Service** — the whole product is a record of your
  school's children, categories and payments, so this data is the product.
- **To authenticate and authorize** — so only the right people at your
  school can see your school's records, and no one else's.
- **To bill your school** for the subscription.
- **For security and audit purposes** — the append-only activity log lets
  your school (and, if ever necessary, us) answer "who did what and when,"
  which matters both for your own internal bookkeeping and for responding
  to any suspected account compromise.
- **To comply with the law** — for example, responding to a valid legal
  request, or notifying you and any applicable regulator if a personal
  data breach occurs (see "If something goes wrong" below).

We do not use your school's data, or the children's/families' data
recorded in it, to train any AI/ML model, and we do not share it with data
brokers or advertisers.

## Who else sees this data

We use a small number of service providers ("subprocessors") to run the
Service. Each only sees the minimum data needed to do its specific job:

- **[HOSTING PROVIDER, e.g. Vercel]** — hosts the application and database
  infrastructure.
- **[DATABASE PROVIDER — fill in once chosen]** — stores the database.
- **Stripe** — processes subscription payments. Stripe sees your school's
  billing contact and card details directly; we never receive or store
  full card numbers.
- **[EMAIL PROVIDER — fill in once wired up, e.g. Resend]** — sends
  transactional emails (invite links, notifications) once that feature is
  live.

We do not sell personal information, and we do not share it with anyone
else except: (a) the subprocessors above, each bound by their own
confidentiality/data-processing terms; (b) if legally compelled (e.g. a
valid court order); or (c) with your explicit consent.

## Where data is stored

[FILL IN: which region(s) your hosting and database provider store data
in. If any of your subprocessors store or process data outside South
Africa, POPIA requires either the destination country to have adequate
data protection laws, or specific safeguards/consent — get legal advice on
this before finalizing.]

## How long we keep it

- **While your subscription is active:** for as long as your school
  continues using the Service.
- **After cancellation:** [DECIDE AND FILL IN — a common approach is to
  keep data for a defined grace period, e.g. 30-90 days, in case the school
  wants to reactivate or export it, then permanently delete it. Some
  financial-record retention obligations may require longer retention of
  payment/receipt records specifically — check local requirements.]
- **Audit logs:** kept for [FILL IN — e.g. 12 months] to support security
  investigations, then deleted.
- Archived (soft-deleted) children/categories remain in your school's own
  data until the school itself permanently removes them or the retention
  period above ends — archiving is reversible on purpose, so a mistaken
  click doesn't destroy records.

## How we protect this data

- Passwords are hashed (never stored in a form anyone — including us —
  could read back out) using bcrypt.
- Every school's data is isolated from every other school's at the
  database level; access always requires being an authenticated member of
  that specific school's account, with the appropriate role.
- Bank account numbers are encrypted at rest.
- All traffic to the Service is encrypted in transit (HTTPS/TLS).
- Access to production data by our own team is limited to what's needed
  for support and maintenance, and is logged.
- We run automated dependency vulnerability scanning and keep the
  Service's software dependencies up to date.

No system is perfectly secure, and we can't guarantee absolute security —
but the above are the concrete measures currently in place.
[EXPAND THIS SECTION as you add more infrastructure — e.g. once you have a
managed Postgres provider with encryption at rest, backups, etc., name
them here specifically; a generic security section reads as less credible
than a specific one.]

## Your school's rights, and your responsibilities as the data controller

Because your school controls what personal information it records about
children and families, your school is responsible for:

- Having a lawful basis to collect and store that information (for
  example, your school's own enrollment agreement with parents/guardians).
- Telling the families you serve that their and their children's
  information is processed using a system like this one, and pointing them
  to your own privacy notice (this document describes what *we* do with
  the data on your instructions — it isn't a substitute for your school's
  own notice to parents).
- Responding to requests from parents/guardians to access, correct, or
  delete their own or their child's information — the Service gives you
  the tools to do this (edit/archive records, export statements); reach out
  to **[SUPPORT EMAIL]** if you need help with something the interface
  doesn't cover.

If you (the school) are in South Africa, POPIA gives the people whose data
you hold rights including access, correction, and objection to processing
— your school, as the responsible party, is the one who needs to be able
to respond to those requests; we provide the tools that make that
possible.

## If something goes wrong

If we become aware of a security incident that resulted in unauthorized
access to personal information, we will notify affected schools without
undue delay, and will support you in meeting your own notification
obligations to affected families and, where required, the Information
Regulator (South Africa) or other applicable authority. [This is a
placeholder commitment — replace with your actual, tested incident
response process once it exists; see SECURITY.md item 7 in the main
project repo.]

## Changes to this policy

We'll update the "Last updated" date above when this policy changes, and
[DECIDE: will you email customers on material changes? Recommended for
anything that changes how children's/families' data is handled.]

## Contact

Questions about this policy, or to exercise a data-related request:
**[SUPPORT/PRIVACY EMAIL ADDRESS]**, **[PHYSICAL ADDRESS if required in
your jurisdiction]**.
