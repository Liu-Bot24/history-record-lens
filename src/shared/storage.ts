import type { AppSettings, CleanupLogEntry, SiteRule } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const SETTINGS_KEY = "settings";
const SITE_RULES_KEY = "siteRules";
const CLEANUP_LOG_KEY = "cleanupLog";

function assertChromeStorage() {
  if (!globalThis.chrome?.storage?.local) {
    throw new Error("Chrome storage API is not available.");
  }
}

export async function getSettings(): Promise<AppSettings> {
  assertChromeStorage();
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<AppSettings> | undefined) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  assertChromeStorage();
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getSiteRules(): Promise<SiteRule[]> {
  assertChromeStorage();
  const result = await chrome.storage.local.get(SITE_RULES_KEY);
  return (result[SITE_RULES_KEY] as SiteRule[] | undefined) ?? [];
}

export async function saveSiteRules(rules: SiteRule[]): Promise<void> {
  assertChromeStorage();
  await chrome.storage.local.set({ [SITE_RULES_KEY]: rules });
}

export async function getCleanupLog(): Promise<CleanupLogEntry[]> {
  assertChromeStorage();
  const result = await chrome.storage.local.get(CLEANUP_LOG_KEY);
  return (result[CLEANUP_LOG_KEY] as CleanupLogEntry[] | undefined) ?? [];
}

export async function appendCleanupLog(entry: CleanupLogEntry): Promise<void> {
  const previous = await getCleanupLog();
  await chrome.storage.local.set({ [CLEANUP_LOG_KEY]: [entry, ...previous].slice(0, 50) });
}
