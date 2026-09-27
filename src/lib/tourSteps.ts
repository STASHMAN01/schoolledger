// Step content for the first-time guided walkthrough (one tour per mode,
// shown on that mode's home page -- see docs/PROGRESS.md for the scoping
// decisions behind this). Each step targets a `data-tour="<target>"`
// attribute somewhere in the dashboard; TourOverlay skips any step whose
// target isn't in the DOM right now (hidden by a permission, or -- on a
// phone -- tucked into the ☰ menu instead of the header) rather than
// showing an empty spotlight, so these lists don't need to be filtered by
// role here.

export type TourStep = {
  target: string;
  title: string;
  description: string;
};

export const CENTRE_TOUR_STEPS: TourStep[] = [
  {
    target: "mode-switch",
    title: "Two modes, one school",
    description:
      "Centre Management is the day-to-day running of your school — enrolment, attendance, classes and staff. Accounting is fees, payments and reminders. Switch between them here any time; the app remembers your last mode next time you log in.",
  },
  {
    target: "tile-admissions",
    title: "Admissions",
    description: "New children this week, month or ever — tap the number to see the list, newest first.",
  },
  {
    target: "tile-attendance",
    title: "Attendance",
    description:
      "Today's register at a glance. Present is just a count; tap Absent to see who's away and email their parents in one tap.",
  },
  {
    target: "tile-online-submissions",
    title: "Online submissions",
    description:
      "When a parent fills in an online enrolment or update form, it lands here for you to review and approve before anything changes on the child's real profile.",
  },
  {
    target: "tile-enrolled",
    title: "Enrolled",
    description: "Every currently enrolled child, with gender and age breakdowns, grouped by class.",
  },
  {
    target: "tile-staff",
    title: "Staff",
    description: "Your team, their roles, and which class each teacher is assigned to.",
  },
  {
    target: "tile-upcoming-events",
    title: "Upcoming events",
    description:
      "School events coming up. This is names and dates only — amounts and billing for events live in Accounting.",
  },
  {
    target: "tile-classes",
    title: "Classes",
    description: "Set up classes, age groups, and see how many children and teachers are in each.",
  },
  {
    target: "nav-forms",
    title: "Forms",
    description:
      "Generate a pre-filled enrolment, indemnity, medical or other form for any child, or send a parent a link to fill one in themselves on their phone.",
  },
  {
    target: "todo-panel",
    title: "Your to-do list",
    description:
      "Things the app noticed that need your attention — like an untaken register or a child with an incomplete profile. Each item clears itself once it's handled; nothing to tick manually.",
  },
  {
    target: "recent-activity",
    title: "Recent centre activity",
    description: "A live log of what's happened in Centre Management — who added a child, took attendance, or updated a profile.",
  },
  {
    target: "header-communication",
    title: "Communication",
    description: "Track which parents have been added to each class's WhatsApp group — a checklist, not an integration.",
  },
  {
    target: "header-support",
    title: "Support",
    description: "Help articles and how to use Crechely, any time you need a refresher.",
  },
];

export const ACCOUNTING_TOUR_STEPS: TourStep[] = [
  {
    target: "mode-switch",
    title: "Two modes, one school",
    description:
      "Accounting is fees, payments and reminders. Centre Management is the day-to-day running of your school. Switch between them here any time.",
  },
  {
    target: "tile-outstanding",
    title: "Outstanding",
    description: "Everything owed right now. Tap it to see the breakdown by class.",
  },
  {
    target: "tile-paid",
    title: "Paid this month",
    description: "Payments received this calendar month, broken down by class.",
  },
  {
    target: "tile-due",
    title: "Accounts due",
    description: "Every child with an outstanding balance — tap to see who, and how much.",
  },
  {
    target: "tile-reminders",
    title: "Reminders",
    description: "Parents who owe money and haven't been reminded yet. Reminders go out by email only.",
  },
  {
    target: "tile-children",
    title: "Children",
    description: "Every active child, their class and their fee.",
  },
  {
    target: "nav-payments",
    title: "Payments",
    description: "Record a payment, see payment history, and export it as a spreadsheet.",
  },
  {
    target: "nav-classes-accounting",
    title: "Classes",
    description: "Set the monthly fee for each class — the billing side of the same classes you manage in Centre Management.",
  },
  {
    target: "nav-events-accounting",
    title: "Events",
    description: "Charge children for a school event and track who's paid.",
  },
  {
    target: "nav-settings",
    title: "Settings",
    description:
      "School details, payment types, your team's roles and permissions, the activity log, trash, billing, and full data backups all live here.",
  },
  {
    target: "todo-panel",
    title: "Your to-do list",
    description: "Things the app noticed that need your attention — like an unsent reminder. Each item clears itself once it's handled.",
  },
  {
    target: "recent-activity",
    title: "Recent accounting activity",
    description: "A live log of payments recorded, reminders sent, and other billing actions.",
  },
  {
    target: "header-support",
    title: "Support",
    description: "Help articles and how to use Crechely, any time you need a refresher.",
  },
];
