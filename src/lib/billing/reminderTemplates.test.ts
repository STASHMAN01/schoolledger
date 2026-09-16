import { describe, it, expect } from "vitest";
import {
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_TEMPLATES,
  missingRequiredPlaceholders,
  renderReminderTemplate,
} from "./reminderTemplates";

describe("REMINDER_TEMPLATES", () => {
  it("has exactly 5 built-in options", () => {
    expect(REMINDER_TEMPLATES).toHaveLength(5);
  });

  it("every built-in template includes all 3 required placeholders", () => {
    for (const t of REMINDER_TEMPLATES) {
      expect(missingRequiredPlaceholders(t.body)).toEqual([]);
    }
  });

  it("the default template is the first built-in option", () => {
    expect(DEFAULT_REMINDER_TEMPLATE).toBe(REMINDER_TEMPLATES[0].body);
  });
});

describe("missingRequiredPlaceholders", () => {
  it("flags all 3 as missing from plain text", () => {
    expect(missingRequiredPlaceholders("hello there")).toEqual([
      "{{childName}}",
      "{{parentName}}",
      "{{amount}}",
    ]);
  });

  it("returns an empty list once all 3 are present, in any order", () => {
    expect(
      missingRequiredPlaceholders("{{amount}} owed by {{parentName}} for {{childName}}")
    ).toEqual([]);
  });

  it("doesn't require the optional {{schoolName}} placeholder", () => {
    expect(
      missingRequiredPlaceholders("{{parentName}} owes {{amount}} for {{childName}}")
    ).toEqual([]);
  });
});

describe("renderReminderTemplate", () => {
  it("substitutes every placeholder", () => {
    const result = renderReminderTemplate(
      "{{parentName}}, {{childName}} owes {{amount}} at {{schoolName}}.",
      {
        schoolName: "Dee's Duckling Centre",
        parentName: "Mrs Smith",
        childName: "Alice Smith",
        amount: "R1400.00",
      }
    );
    expect(result).toBe("Mrs Smith, Alice Smith owes R1400.00 at Dee's Duckling Centre.");
  });

  it("substitutes a placeholder that appears more than once", () => {
    const result = renderReminderTemplate("{{childName}} - {{childName}}", {
      schoolName: "",
      parentName: "",
      childName: "Alice",
      amount: "",
    });
    expect(result).toBe("Alice - Alice");
  });

  it("leaves an unrecognized token untouched", () => {
    const result = renderReminderTemplate("Hi {{notAToken}} {{parentName}}", {
      schoolName: "",
      parentName: "Mrs Smith",
      childName: "",
      amount: "",
    });
    expect(result).toBe("Hi {{notAToken}} Mrs Smith");
  });
});
