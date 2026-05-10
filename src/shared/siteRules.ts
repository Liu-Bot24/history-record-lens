import type { HistoryRecord, PatternKind, SitePattern, SiteRule } from "./types";
import {
  cleanUrlPattern,
  ensureHttpUrl,
  extractHost,
  hostAndPath,
  hostMatchesPattern,
  labelFromUrl,
  normalizeComparableUrl
} from "./url";

export function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

export function normalizePatternValue(kind: PatternKind, value: string): string {
  if (kind === "domain") return extractHost(value);
  if (kind === "keyword") return value.trim();
  return cleanUrlPattern(value);
}

export function createPattern(kind: PatternKind, value: string): SitePattern {
  return {
    id: newId("pattern"),
    kind,
    value: normalizePatternValue(kind, value)
  };
}

export function createSiteRule(input: Partial<SiteRule> & { homeUrl: string; name?: string }): SiteRule {
  const now = Date.now();
  const homeUrl = ensureHttpUrl(input.homeUrl);
  const host = extractHost(homeUrl);
  return {
    id: input.id ?? newId("site"),
    name: input.name?.trim() || labelFromUrl(homeUrl),
    homeUrl,
    patterns: input.patterns?.length ? input.patterns : [createPattern("domain", host)],
    enabled: input.enabled ?? true,
    quickAccess: input.quickAccess ?? true,
    cleanupEnabled: input.cleanupEnabled ?? false,
    cleanupOnTabClose: input.cleanupOnTabClose ?? false,
    confirmBeforeCleanup: input.confirmBeforeCleanup ?? false,
    createdAt: input.createdAt ?? now,
    updatedAt: now
  };
}

export function patternMatchesUrl(pattern: SitePattern, url: string, title = ""): boolean {
  const { host } = hostAndPath(url);
  const comparableUrl = normalizeComparableUrl(url);
  const comparablePattern = normalizePatternValue(pattern.kind, pattern.value).toLowerCase();

  if (!comparablePattern) return false;

  switch (pattern.kind) {
    case "domain":
      return hostMatchesPattern(host, comparablePattern);
    case "urlPrefix":
      return comparableUrl.startsWith(comparablePattern);
    case "urlContains":
      return comparableUrl.includes(comparablePattern);
    case "exactUrl":
      return comparableUrl === comparablePattern;
    case "keyword":
      return `${title} ${url}`.toLowerCase().includes(comparablePattern.toLowerCase());
  }
}

export function ruleMatchesUrl(rule: SiteRule, url: string, title = ""): boolean {
  if (!rule.enabled) return false;
  return rule.patterns.some((pattern) => patternMatchesUrl(pattern, url, title));
}

export function ruleMatchesRecord(rule: SiteRule, record: HistoryRecord): boolean {
  return ruleMatchesUrl(rule, record.url, record.title);
}

export function filterRecordsByRule(records: HistoryRecord[], rule: SiteRule): HistoryRecord[] {
  return records.filter((record) => ruleMatchesRecord(rule, record));
}

export function parseSiteListImport(input: string): SiteRule[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t|]/).map((part) => part.trim()).filter(Boolean);
      if (parts.length === 1) return createSiteRule({ homeUrl: parts[0], quickAccess: false, cleanupEnabled: true });

      const [name, homeUrl, ...patterns] = parts;
      return createSiteRule({
        name,
        homeUrl,
        quickAccess: false,
        cleanupEnabled: true,
        patterns: patterns.length
          ? patterns.map((pattern) => createPattern("domain", pattern))
          : [createPattern("domain", homeUrl)]
      });
    });
}
