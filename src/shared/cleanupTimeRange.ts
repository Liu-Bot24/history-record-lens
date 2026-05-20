import type { CleanupTimeRange, HistoryFilter } from "./types";

export const cleanupTimeRangeOptions: Array<{ mode: CleanupTimeRange["mode"]; label: string }> = [
  { mode: "all", label: "All time" },
  { mode: "hour", label: "Past hour" },
  { mode: "day", label: "Past day" },
  { mode: "week", label: "Past week" },
  { mode: "custom", label: "Custom range" }
];

export function cleanupTimeRangeToFilter(range: CleanupTimeRange, now = Date.now()): HistoryFilter {
  if (range.mode === "hour") return { startTime: now - 60 * 60 * 1000 };
  if (range.mode === "day") return { startTime: now - 24 * 60 * 60 * 1000 };
  if (range.mode === "week") return { startTime: now - 7 * 24 * 60 * 60 * 1000 };
  if (range.mode !== "custom") return {};

  const startTime = range.startDate ? new Date(`${range.startDate}T00:00:00`).getTime() : undefined;
  const endTime = range.endDate ? new Date(`${range.endDate}T23:59:59.999`).getTime() : undefined;
  return {
    startTime: Number.isFinite(startTime) ? startTime : undefined,
    endTime: Number.isFinite(endTime) ? endTime : undefined
  };
}

export function cleanupTimeRangeLabel(range: CleanupTimeRange): string {
  const option = cleanupTimeRangeOptions.find((item) => item.mode === range.mode);
  if (range.mode !== "custom") return option?.label ?? "All time";
  if (range.startDate && range.endDate) return `${range.startDate} to ${range.endDate}`;
  if (range.startDate) return `From ${range.startDate}`;
  if (range.endDate) return `Before ${range.endDate}`;
  return "Custom range";
}
