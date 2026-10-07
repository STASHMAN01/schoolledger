import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("neutralises tags and attribute breakouts", () => {
    expect(escapeHtml(`Sunflower <a href="https://evil.example">Pay</a>`)).toBe(
      "Sunflower &lt;a href=&quot;https://evil.example&quot;&gt;Pay&lt;/a&gt;"
    );
    expect(escapeHtml(`O'Brien & Sons`)).toBe("O&#39;Brien &amp; Sons");
  });

  it("handles null and numbers", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(7)).toBe("7");
  });
});
