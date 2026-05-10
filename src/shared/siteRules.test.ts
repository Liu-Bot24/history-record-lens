import { describe, expect, it } from "vitest";
import { createPattern, createSiteRule, parseSiteListImport, ruleMatchesUrl } from "./siteRules";

describe("site rules", () => {
  it("matches configured domains", () => {
    const rule = createSiteRule({
      name: "YouTube",
      homeUrl: "https://youtube.com",
      patterns: [createPattern("domain", "youtube.com"), createPattern("domain", "youtu.be")]
    });

    expect(ruleMatchesUrl(rule, "https://www.youtube.com/watch?v=1")).toBe(true);
    expect(ruleMatchesUrl(rule, "https://youtu.be/abc")).toBe(true);
    expect(ruleMatchesUrl(rule, "https://notyoutube.com/watch")).toBe(false);
  });

  it("supports URL prefix and keyword patterns", () => {
    const rule = createSiteRule({
      name: "Docs",
      homeUrl: "https://developer.chrome.com",
      patterns: [createPattern("urlPrefix", "developer.chrome.com/docs"), createPattern("keyword", "extension")]
    });

    expect(ruleMatchesUrl(rule, "https://developer.chrome.com/docs/extensions/reference/api/history")).toBe(true);
    expect(ruleMatchesUrl(rule, "https://example.com/post", "Chrome extension notes")).toBe(true);
    expect(ruleMatchesUrl(rule, "https://developer.chrome.com/blog")).toBe(false);
  });

  it("imports simple site lists", () => {
    const rules = parseSiteListImport("YouTube, https://youtube.com, youtube.com, youtu.be\nhttps://www.bilibili.com");
    expect(rules).toHaveLength(2);
    expect(rules[0].name).toBe("YouTube");
    expect(rules[0].quickAccess).toBe(false);
    expect(rules[0].cleanupEnabled).toBe(true);
    expect(rules[1].name).toBe("Bilibili");
  });
});
