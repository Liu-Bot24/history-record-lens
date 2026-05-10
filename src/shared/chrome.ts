import type { HistoryFilter, HistoryRecord } from "./types";
import { buildDeletePreview, filterRecords, historyItemToRecord, mergeUniqueRecords, sortRecordsByRecent } from "./historyFilters";

const DEFAULT_HISTORY_LIMIT = 100_000;

function assertChromeHistory() {
  if (!globalThis.chrome?.history) {
    throw new Error("Chrome history API is not available.");
  }
}

export function buildHistorySearchQuery(filter: HistoryFilter): chrome.history.HistoryQuery {
  return {
    text: filter.text ?? "",
    startTime: filter.startTime ?? 0,
    endTime: filter.endTime,
    maxResults: filter.maxResults && filter.maxResults > 0 ? filter.maxResults : DEFAULT_HISTORY_LIMIT
  };
}

export async function searchHistory(filter: HistoryFilter): Promise<HistoryRecord[]> {
  assertChromeHistory();
  const items = await chrome.history.search(buildHistorySearchQuery(filter));
  const records = mergeUniqueRecords(items.map(historyItemToRecord).filter(Boolean) as HistoryRecord[]);
  return sortRecordsByRecent(filterRecords(records, filter));
}

export async function deleteHistoryUrls(urls: string[]): Promise<number> {
  assertChromeHistory();
  const uniqueUrls = Array.from(new Set(urls));
  for (const url of uniqueUrls) {
    await chrome.history.deleteUrl({ url });
  }
  return uniqueUrls.length;
}

export async function previewHistoryDelete(filter: HistoryFilter) {
  const records = await searchHistory(filter);
  return buildDeletePreview(records);
}
