import { afterEach, describe, expect, it, vi } from "vitest";
import { isPasswordBreached } from "./password";

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
afterEach(() => vi.unstubAllGlobals());

describe("isPasswordBreached (security review #13)", () => {
  it("sends only the 5-character prefix and matches the suffix", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\nAAAA:0"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await isPasswordBreached("password")).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.pwnedpasswords.com/range/5BAA6");
  });

  it("ignores padding rows (count 0) and other hashes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:0\r\nFFFF:12")));
    expect(await isPasswordBreached("password")).toBe(false);
  });

  it("fails open when the service is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await isPasswordBreached("password")).toBe(false);
  });
});
