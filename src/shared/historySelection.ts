import type { HistoryRecord } from "./types";

export function selectedHistoryRecords(records: HistoryRecord[], selectedIds: Set<string>): HistoryRecord[] {
  return records.filter((record) => selectedIds.has(record.id));
}

export function selectedHistoryUrls(records: HistoryRecord[], selectedIds: Set<string>): string[] {
  return selectedHistoryRecords(records, selectedIds).map((record) => record.url);
}

export function toggleHistorySelection(selectedIds: Set<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectAllHistory(records: HistoryRecord[]): Set<string> {
  return new Set(records.map((record) => record.id));
}

export function pruneHistorySelection(records: HistoryRecord[], selectedIds: Set<string>): Set<string> {
  const visibleIds = new Set(records.map((record) => record.id));
  return new Set([...selectedIds].filter((id) => visibleIds.has(id)));
}
