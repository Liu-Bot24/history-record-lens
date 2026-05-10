import type { AiMatch, AiQueryDebug, AppSettings, CleanupLogEntry, HistoryFilter, HistoryRecord, SiteRule } from "./types";

export type BackgroundRequest =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: AppSettings }
  | { type: "TEST_AI_PROVIDER"; providerId: string }
  | { type: "GET_SITE_RULES" }
  | { type: "SAVE_SITE_RULES"; rules: SiteRule[] }
  | { type: "GET_ACTIVE_TAB" }
  | { type: "GET_CLEANUP_LOG" }
  | { type: "SEARCH_HISTORY"; filter: HistoryFilter }
  | { type: "DELETE_URLS"; urls: string[] }
  | { type: "DELETE_FILTERED"; filter: HistoryFilter }
  | { type: "OPEN_URL"; url: string }
  | { type: "CLEAN_SITE_RULE"; ruleId: string }
  | { type: "AI_QUERY"; providerId: string; query: string; filter: HistoryFilter };

export type BackgroundDataMap = {
  GET_SETTINGS: AppSettings;
  SAVE_SETTINGS: AppSettings;
  TEST_AI_PROVIDER: { ok: true };
  GET_SITE_RULES: SiteRule[];
  SAVE_SITE_RULES: SiteRule[];
  GET_ACTIVE_TAB: { title: string; url: string };
  GET_CLEANUP_LOG: CleanupLogEntry[];
  SEARCH_HISTORY: HistoryRecord[];
  DELETE_URLS: { deletedCount: number };
  DELETE_FILTERED: { deletedCount: number };
  OPEN_URL: { opened: true };
  CLEAN_SITE_RULE: { deletedCount: number };
  AI_QUERY: { matches: AiMatch[]; records: HistoryRecord[]; debug: AiQueryDebug };
};

export type BackgroundResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
