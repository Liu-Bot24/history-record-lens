import { describe, expect, it } from "vitest";
import { createTranslator, formatCount, formatHistoryTime } from "./i18n";

describe("i18n", () => {
  it("translates shared UI labels in English and Chinese", () => {
    expect(createTranslator("en")("app.title")).toBe("History Record Lens");
    expect(createTranslator("zh")("app.title")).toBe("历史记录透镜");
  });

  it("formats counts in the selected language", () => {
    expect(formatCount("en", "historyRecord", 2)).toBe("2 history records");
    expect(formatCount("zh", "historyRecord", 2)).toBe("2 条历史记录");
  });

  it("formats history timestamps in the selected language", () => {
    const time = new Date("2026-05-21T04:30:00.000Z").getTime();

    expect(formatHistoryTime("en", time)).toContain("May");
    expect(formatHistoryTime("zh", time)).toContain("5月");
  });
});
