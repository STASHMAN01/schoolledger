// Reminder message templates — pure/DB-free, same reasoning as
// reminders.ts (see that file's top comment): this needs to be safely
// importable from a Vitest test without pulling in @/lib/db.
//
// A template is plain text with a handful of {{token}} placeholders,
// filled in per-child at render time. Three tokens are mandatory in every
// template (enforced by missingRequiredPlaceholders, called wherever a
// custom template is saved) per the org owner's own requirement: the
// child's name, the parent's name, and the amount owing must always be
// present — everything else in the message is free text the org can write
// however they like. {{schoolName}} is available but optional.

export type ReminderTemplateVars = {
  schoolName: string;
  parentName: string;
  childName: string;
  amount: string; // pre-formatted with the org's currency, e.g. "R1,400.00"
};

export type ReminderTemplateOption = {
  id: string;
  label: string;
  body: string;
};

export const REMINDER_TEMPLATES: ReminderTemplateOption[] = [
  {
    id: "friendly",
    label: "Friendly (default)",
    body: "Hi {{parentName}}, this is a friendly reminder from {{schoolName}} that {{childName}}'s account has an outstanding balance of {{amount}}. Please let us know if you have any questions. Thank you!",
  },
  {
    id: "formal",
    label: "Formal",
    body: "Dear {{parentName}},\n\nPlease note that {{childName}}'s account currently reflects an outstanding balance of {{amount}}. Kindly arrange payment at your earliest convenience.\n\nRegards,\n{{schoolName}}",
  },
  {
    id: "short",
    label: "Short & direct",
    body: "Hi {{parentName}}, {{childName}} has an outstanding balance of {{amount}}. Please settle when you can. Thanks — {{schoolName}}",
  },
  {
    id: "overdue",
    label: "Overdue follow-up",
    body: "Hi {{parentName}}, this is a follow-up reminder that {{childName}}'s account has an overdue balance of {{amount}}. Please make payment as soon as possible to avoid any disruption. Thank you, {{schoolName}}",
  },
  {
    id: "warm",
    label: "Warm & detailed",
    body: "Hello {{parentName}}!\n\nWe hope {{childName}} is doing well. This is just a gentle reminder that there's an outstanding balance of {{amount}} on the account. If you've already paid, please disregard this message — otherwise we'd appreciate payment when convenient.\n\nWarm regards,\n{{schoolName}}",
  },
];

export const DEFAULT_REMINDER_TEMPLATE = REMINDER_TEMPLATES[0].body;

export const REQUIRED_TEMPLATE_PLACEHOLDERS = [
  "{{childName}}",
  "{{parentName}}",
  "{{amount}}",
] as const;

export function missingRequiredPlaceholders(template: string): string[] {
  return REQUIRED_TEMPLATE_PLACEHOLDERS.filter((p) => !template.includes(p));
}

export function renderReminderTemplate(
  template: string,
  vars: ReminderTemplateVars
): string {
  return template
    .split("{{schoolName}}").join(vars.schoolName)
    .split("{{parentName}}").join(vars.parentName)
    .split("{{childName}}").join(vars.childName)
    .split("{{amount}}").join(vars.amount);
}
