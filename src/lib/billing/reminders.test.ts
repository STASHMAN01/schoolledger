import { describe, it, expect } from "vitest";
import {
  buildReminderEmailHtml,
  buildReminderMessage,
  whatsAppLink,
  mailtoLink,
} from "./reminders";

describe("buildReminderMessage", () => {
  it("includes the parent, child, and formatted amount", () => {
    const msg = buildReminderMessage({
      schoolName: "Dee's Duckling Centre",
      parentName: "Mrs Smith",
      childName: "Alice Smith",
      outstandingCents: 140_000,
      currencyCode: "ZAR",
    });
    expect(msg).toContain("Mrs Smith");
    expect(msg).toContain("Alice Smith");
    expect(msg).toContain("Dee's Duckling Centre");
    expect(msg).toContain("R1400.00");
  });
});

describe("buildReminderEmailHtml", () => {
  it("wraps the same message text in a paragraph tag", () => {
    const input = {
      schoolName: "Dee's Duckling Centre",
      parentName: "Mrs Smith",
      childName: "Alice Smith",
      outstandingCents: 140_000,
      currencyCode: "ZAR",
    };
    const html = buildReminderEmailHtml(input);
    expect(html.startsWith("<p>")).toBe(true);
    expect(html.endsWith("</p>")).toBe(true);
    expect(html).toContain(buildReminderMessage(input));
  });
});

describe("whatsAppLink", () => {
  it("strips the leading + and formatting from an E.164 number", () => {
    const link = whatsAppLink("+27 82 123 4567", "hello");
    expect(link).toBe("https://wa.me/27821234567?text=hello");
  });

  it("URL-encodes the message text", () => {
    const link = whatsAppLink("+27821234567", "R1,400.00 owed!");
    expect(link).toContain(encodeURIComponent("R1,400.00 owed!"));
    expect(link).not.toContain(" ");
  });
});

describe("mailtoLink", () => {
  it("builds a mailto link with an encoded subject and body", () => {
    const link = mailtoLink("parent@example.com", "Payment reminder", "You owe money");
    expect(link).toBe(
      "mailto:parent@example.com?subject=Payment%20reminder&body=You%20owe%20money"
    );
  });
});
