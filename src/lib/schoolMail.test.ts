import { describe, it, expect } from "vitest";
import { safeDisplayName, schoolFromAddress, schoolSlug } from "./schoolMail";
import { saDateParts } from "./autoReminders";

describe("school sender address", () => {
  it("makes a clean slug from the school name", () => {
    expect(schoolSlug("Sunny Smiles Pre-School (Pty) Ltd")).toBe("sunny-smiles-pre-school-pty-ltd");
    expect(schoolSlug("Kleuterskool Blommeland!")).toBe("kleuterskool-blommeland");
    expect(schoolSlug("Crèche Élan")).toBe("creche-elan");
    expect(schoolSlug("***")).toBe("school");
  });
  it("keeps quotes and angle brackets out of the From header", () => {
    expect(safeDisplayName('Tiny "Tots" <Academy>')).toBe("Tiny Tots Academy");
    expect(schoolFromAddress("Tango's Tots")).toBe("Tango's Tots <tango-s-tots@mail.crechely.co.za>");
  });
});

describe("South African date for the reminders cron", () => {
  it("rolls over at midnight SAST, not UTC", () => {
    expect(saDateParts(new Date("2026-09-30T21:59:00Z"))).toEqual({ isoDate: "2026-09-30", day: 30 });
    expect(saDateParts(new Date("2026-09-30T22:01:00Z"))).toEqual({ isoDate: "2026-10-01", day: 1 });
  });
});

import { vi, afterEach } from "vitest";
import { sendSchoolMessages } from "./schoolMail";

describe("sending through Resend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
  });

  it("batches plain reminders and sends ones with a statement one at a time", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response("{}", { status: 200 });
    });
    const sender = { schoolName: "Sunny Smiles", replyTo: "office@sunny.co.za" };
    const plain = await sendSchoolMessages(sender, [
      { to: "a@x.co", subject: "s", html: "h", text: "t" },
      { to: "b@x.co", subject: "s", html: "h", text: "t" },
    ]);
    expect(plain.every((r) => r.sent)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails/batch");

    calls.length = 0;
    const withPdf = await sendSchoolMessages(sender, [
      { to: "a@x.co", subject: "s", html: "h", text: "t", attachments: [{ filename: "s.pdf", content: new Uint8Array([37, 80, 68, 70]) }] },
    ]);
    expect(withPdf[0].sent).toBe(true);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    const body = calls[0].body as { from: string; reply_to: string; attachments: { filename: string; content: string }[] };
    expect(body.from).toBe("Sunny Smiles <sunny-smiles@mail.crechely.co.za>");
    expect(body.reply_to).toBe("office@sunny.co.za");
    expect(body.attachments[0]).toEqual({ filename: "s.pdf", content: "JVBERg==" });
  });
});
