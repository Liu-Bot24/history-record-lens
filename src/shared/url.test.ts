import { describe, expect, it } from "vitest";
import { cleanUrlPattern, extractHost, hostMatchesPattern, originPermissionPattern, sanitizeUrlForAi } from "./url";

describe("url helpers", () => {
  it("cleans pasted URLs without aggressively trimming paths", () => {
    expect(cleanUrlPattern("https://www.youtube.com/watch?v=abc")).toBe("www.youtube.com/watch?v=abc");
    expect(cleanUrlPattern("http://example.com/section/")).toBe("example.com/section");
  });

  it("extracts host from URL-like user input", () => {
    expect(extractHost("https://www.bilibili.com/video/BV1")).toBe("www.bilibili.com");
    expect(extractHost("youtube.com/watch")).toBe("youtube.com");
  });

  it("matches exact domains and subdomains without substring false positives", () => {
    expect(hostMatchesPattern("www.youtube.com", "youtube.com")).toBe(true);
    expect(hostMatchesPattern("music.youtube.com", "youtube.com")).toBe(true);
    expect(hostMatchesPattern("notyoutube.com", "youtube.com")).toBe(false);
  });

  it("can strip query strings for AI payloads when configured", () => {
    expect(sanitizeUrlForAi("https://example.com/path?token=secret#hash", false)).toBe("https://example.com/path");
    expect(sanitizeUrlForAi("https://example.com/path?token=secret", true)).toBe("https://example.com/path?token=secret");
  });

  it("creates a narrow optional host permission pattern", () => {
    expect(originPermissionPattern("https://api.openai.com/v1")).toBe("https://api.openai.com/*");
  });
});
