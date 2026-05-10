import { describe, expect, it } from "vitest";
import { cleanupTimeRangeLabel, cleanupTimeRangeToFilter } from "./cleanupTimeRange";

describe("cleanup time ranges", () => {
  const now = new Date("2026-05-10T12:00:00").getTime();

  it("keeps default cleanup unlimited", () => {
    expect(cleanupTimeRangeToFilter({ mode: "all" }, now)).toEqual({});
    expect(cleanupTimeRangeLabel({ mode: "all" })).toBe("不限");
  });

  it("builds quick range filters", () => {
    expect(cleanupTimeRangeToFilter({ mode: "hour" }, now).startTime).toBe(now - 60 * 60 * 1000);
    expect(cleanupTimeRangeToFilter({ mode: "day" }, now).startTime).toBe(now - 24 * 60 * 60 * 1000);
    expect(cleanupTimeRangeToFilter({ mode: "week" }, now).startTime).toBe(now - 7 * 24 * 60 * 60 * 1000);
  });

  it("builds custom date range filters", () => {
    const filter = cleanupTimeRangeToFilter({ mode: "custom", startDate: "2026-05-01", endDate: "2026-05-10" }, now);
    expect(filter.startTime).toBe(new Date("2026-05-01T00:00:00").getTime());
    expect(filter.endTime).toBe(new Date("2026-05-10T23:59:59.999").getTime());
    expect(cleanupTimeRangeLabel({ mode: "custom", startDate: "2026-05-01", endDate: "2026-05-10" })).toBe("2026-05-01 至 2026-05-10");
  });
});
