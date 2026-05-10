import type { DeletePreview, HistoryFilter, HistoryRecord } from "./types";
import { cleanUrlPattern, hostAndPath, hostMatchesPattern } from "./url";

export function stableHistoryId(url: string): string {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h_${(hash >>> 0).toString(36)}`;
}

export function historyItemToRecord(item: chrome.history.HistoryItem): HistoryRecord | null {
  if (!item.url) return null;
  const { host, path } = hostAndPath(item.url);
  return {
    id: stableHistoryId(item.url),
    title: item.title ?? "",
    url: item.url,
    host,
    path,
    lastVisitTime: item.lastVisitTime ?? 0,
    visitCount: item.visitCount ?? 0,
    typedCount: item.typedCount ?? 0
  };
}

export function recordMatchesFilter(record: HistoryRecord, filter: HistoryFilter): boolean {
  const text = filter.text?.trim().toLowerCase();
  if (text && !`${record.title} ${record.url}`.toLowerCase().includes(text)) return false;

  const domain = filter.domain?.trim();
  if (domain && !hostMatchesPattern(record.host, domain)) return false;

  const urlNeedle = filter.url?.trim();
  if (urlNeedle) {
    const cleanedNeedle = cleanUrlPattern(urlNeedle).toLowerCase();
    const cleanedUrl = cleanUrlPattern(record.url).toLowerCase();
    if (!cleanedUrl.includes(cleanedNeedle)) return false;
  }

  if (filter.startTime && record.lastVisitTime < filter.startTime) return false;
  if (filter.endTime && record.lastVisitTime > filter.endTime) return false;

  return true;
}

export function filterRecords(records: HistoryRecord[], filter: HistoryFilter): HistoryRecord[] {
  return records.filter((record) => recordMatchesFilter(record, filter));
}

export function sortRecordsByRecent(records: HistoryRecord[]): HistoryRecord[] {
  return [...records].sort((a, b) => b.lastVisitTime - a.lastVisitTime);
}

export function buildDeletePreview(records: HistoryRecord[]): DeletePreview {
  const uniqueUrls = Array.from(new Set(records.map((record) => record.url)));
  return { records, uniqueUrls };
}

export function mergeUniqueRecords(records: HistoryRecord[]): HistoryRecord[] {
  const byUrl = new Map<string, HistoryRecord>();
  for (const record of records) {
    const previous = byUrl.get(record.url);
    if (!previous || record.lastVisitTime > previous.lastVisitTime) byUrl.set(record.url, record);
  }
  return sortRecordsByRecent(Array.from(byUrl.values()));
}
