import type { CleanupTimeRange, HistoryFilter } from "./types";

export const cleanupTimeRangeOptions: Array<{ mode: CleanupTimeRange["mode"]; label: string }> = [
  { mode: "all", label: "不限" },
  { mode: "hour", label: "过去一小时" },
  { mode: "day", label: "过去一天" },
  { mode: "week", label: "过去七天" },
  { mode: "custom", label: "日期区间" }
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
  if (range.mode !== "custom") return option?.label ?? "不限";
  if (range.startDate && range.endDate) return `${range.startDate} 至 ${range.endDate}`;
  if (range.startDate) return `${range.startDate} 起`;
  if (range.endDate) return `${range.endDate} 前`;
  return "日期区间";
}
