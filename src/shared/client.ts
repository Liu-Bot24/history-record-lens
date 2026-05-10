import type { BackgroundDataMap, BackgroundRequest, BackgroundResponse } from "./messages";
import type { AppSettings, HistoryRecord, SiteRule } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { originPermissionPattern } from "./url";

const sampleRecords: HistoryRecord[] = [
  {
    id: "sample_1",
    title: "Chrome Extensions History API",
    url: "https://developer.chrome.com/docs/extensions/reference/api/history",
    host: "developer.chrome.com",
    path: "/docs/extensions/reference/api/history",
    lastVisitTime: Date.now() - 3600_000,
    visitCount: 3,
    typedCount: 1
  },
  {
    id: "sample_2",
    title: "Bilibili",
    url: "https://www.bilibili.com/",
    host: "www.bilibili.com",
    path: "",
    lastVisitTime: Date.now() - 7200_000,
    visitCount: 8,
    typedCount: 0
  }
];

export function hasChromeRuntime(): boolean {
  return Boolean(globalThis.chrome?.runtime?.sendMessage);
}

export async function sendToBackground<K extends keyof BackgroundDataMap>(
  request: Extract<BackgroundRequest, { type: K }>
): Promise<BackgroundDataMap[K]> {
  if (!hasChromeRuntime()) return mockResponse(request) as BackgroundDataMap[K];

  const response = (await chrome.runtime.sendMessage(request)) as BackgroundResponse<BackgroundDataMap[K]>;
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

function mockResponse(request: BackgroundRequest): unknown {
  if (request.type === "GET_SETTINGS") return DEFAULT_SETTINGS;
  if (request.type === "GET_SITE_RULES") return [];
  if (request.type === "GET_ACTIVE_TAB") return { title: "Example", url: "https://example.com/" };
  if (request.type === "SEARCH_HISTORY") return sampleRecords;
  if (request.type === "AI_QUERY") {
    return {
      matches: [],
      records: sampleRecords,
      debug: {
        candidateCount: sampleRecords.length,
        batchSize: 1000,
        maxConcurrency: 8,
        batchCount: 1,
        batchReturnedCounts: [0],
        returnedMatchCount: 0,
        uniqueMatchCount: 0,
        batchErrors: [],
        validRecordCount: sampleRecords.length
      }
    };
  }
  if (request.type === "GET_CLEANUP_LOG") return [];
  if (request.type === "DELETE_URLS" || request.type === "DELETE_FILTERED" || request.type === "CLEAN_SITE_RULE") {
    return { deletedCount: 0 };
  }
  if (request.type === "OPEN_URL") return { opened: true };
  if (request.type === "SAVE_SETTINGS") return request.settings;
  if (request.type === "SAVE_SITE_RULES") return request.rules;
  if (request.type === "TEST_AI_PROVIDER") return { ok: true };
  return null;
}

export async function ensureApiHostPermission(settings: AppSettings, providerId: string): Promise<boolean> {
  if (!globalThis.chrome?.permissions) return true;
  const provider = settings.aiProviders.find((item) => item.id === providerId);
  if (!provider) return false;
  const pattern = originPermissionPattern(provider.baseUrl);
  if (!pattern) return false;
  const alreadyAllowed = await chrome.permissions.contains({ origins: [pattern] });
  if (alreadyAllowed) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

export function reorderDefaultProvider(settings: AppSettings, providerId: string): AppSettings {
  return {
    ...settings,
    defaultProviderId: providerId,
    aiProviders: settings.aiProviders.map((provider) => ({
      ...provider,
      isDefault: provider.id === providerId
    }))
  };
}

export function upsertSiteRule(rules: SiteRule[], rule: SiteRule): SiteRule[] {
  const exists = rules.some((item) => item.id === rule.id);
  if (!exists) return [rule, ...rules];
  return rules.map((item) => (item.id === rule.id ? rule : item));
}

export function getFaviconUrl(pageUrl: string, size = 16): string {
  if (!globalThis.chrome?.runtime?.getURL) return "";
  const faviconBase = chrome.runtime.getURL("_favicon/");
  return `${faviconBase}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}
