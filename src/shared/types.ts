export type PatternKind = "domain" | "urlPrefix" | "urlContains" | "exactUrl" | "keyword";

export interface SitePattern {
  id: string;
  kind: PatternKind;
  value: string;
}

export interface SiteRule {
  id: string;
  name: string;
  homeUrl: string;
  patterns: SitePattern[];
  enabled: boolean;
  quickAccess: boolean;
  cleanupEnabled: boolean;
  cleanupOnTabClose: boolean;
  confirmBeforeCleanup: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryRecord {
  id: string;
  title: string;
  url: string;
  host: string;
  path: string;
  lastVisitTime: number;
  visitCount: number;
  typedCount: number;
}

export interface HistoryFilter {
  text?: string;
  domain?: string;
  url?: string;
  startTime?: number;
  endTime?: number;
  maxResults?: number;
}

export interface DeletePreview {
  records: HistoryRecord[];
  uniqueUrls: string[];
}

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface AiMatch {
  id: string;
  confidence?: number;
}

export interface AiQueryBatchError {
  batchIndex: number;
  batchSize: number;
  message: string;
}

export interface AiQueryDebug {
  candidateCount: number;
  batchSize: number;
  maxConcurrency: number;
  batchCount: number;
  batchReturnedCounts: number[];
  returnedMatchCount: number;
  uniqueMatchCount: number;
  batchErrors: AiQueryBatchError[];
  validRecordCount?: number;
}

export interface AiQueryOptions {
  includeQueryStrings: boolean;
}

export type CleanupTimeRangeMode = "all" | "hour" | "day" | "week" | "custom";

export interface CleanupTimeRange {
  mode: CleanupTimeRangeMode;
  startDate?: string;
  endDate?: string;
}

export interface AppSettings {
  aiProviders: AiProvider[];
  defaultProviderId?: string;
  includeQueryStringsInAi: boolean;
  aiTemperature: number;
  cleanupTimeRange: CleanupTimeRange;
}

export interface CleanupLogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  deletedCount: number;
  createdAt: number;
  trigger: "manual" | "tabClose";
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProviders: [],
  includeQueryStringsInAi: true,
  aiTemperature: 0,
  cleanupTimeRange: { mode: "all" }
};

export interface RuntimeTabSnapshot {
  tabId: number;
  windowId: number;
  url: string;
  matchedRuleIds: string[];
  updatedAt: number;
}
