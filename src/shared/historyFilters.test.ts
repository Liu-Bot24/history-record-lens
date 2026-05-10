import { describe, expect, it } from "vitest";
import { buildDeletePreview, filterRecords, stableHistoryId } from "./historyFilters";
import type { HistoryRecord } from "./types";

const records: HistoryRecord[] = [
  {
    id: "a",
    title: "Chrome History API",
    url: "https://developer.chrome.com/docs/extensions/reference/api/history",
    host: "developer.chrome.com",
    path: "/docs/extensions/reference/api/history",
    lastVisitTime: 1000,
    visitCount: 3,
    typedCount: 1
  },
  {
    id: "b",
    title: "Video",
    url: "https://www.youtube.com/watch?v=1",
    host: "www.youtube.com",
    path: "/watch",
    lastVisitTime: 2000,
    visitCount: 5,
    typedCount: 0
  }
];

describe("history filters", () => {
  it("filters by keyword, domain, URL text, and time", () => {
    expect(filterRecords(records, { text: "history" }).map((record) => record.id)).toEqual(["a"]);
    expect(filterRecords(records, { domain: "youtube.com" }).map((record) => record.id)).toEqual(["b"]);
    expect(filterRecords(records, { url: "developer.chrome.com/docs" }).map((record) => record.id)).toEqual(["a"]);
    expect(filterRecords(records, { startTime: 1500 }).map((record) => record.id)).toEqual(["b"]);
  });

  it("builds delete preview with unique URLs", () => {
    expect(buildDeletePreview([records[0], records[0]]).uniqueUrls).toEqual([records[0].url]);
  });

  it("creates stable ids from URLs", () => {
    expect(stableHistoryId("https://example.com")).toBe(stableHistoryId("https://example.com"));
  });
});
