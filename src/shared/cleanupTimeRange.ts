import type { CleanupTimeRange, HistoryFilter } from "./types";
import { createTranslator, rangeLabelKey } from "./i18n";
import type { UiLanguage } from "./i18n";

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

export function cleanupTimeRangeLabel(range: CleanupTimeRange, language: UiLanguage = "en"): string {
  const t = createTranslator(language);
  if (range.mode !== "custom") return t(rangeLabelKey(range.mode));
  if (range.startDate && range.endDate) return t("range.to", { start: range.startDate, end: range.endDate });
  if (range.startDate) return t("range.from", { date: range.startDate });
  if (range.endDate) return t("range.before", { date: range.endDate });
  return t("range.custom");
}
