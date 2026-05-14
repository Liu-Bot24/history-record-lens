import { describe, expect, it } from "vitest";
import type { HistoryRecord } from "./types";
import { pruneHistorySelection, selectAllHistory, selectedHistoryUrls, toggleHistorySelection } from "./historySelection";

const records: HistoryRecord[] = [
  {
    id: "a",
    title: "A",
    url: "https://a.example/",
    host: "a.example",
    path: "",
    lastVisitTime: 1,
    visitCount: 1,
    typedCount: 0
  },
  {
    id: "b",
    title: "B",
    url: "https://b.example/",
    host: "b.example",
    path: "",
    lastVisitTime: 2,
    visitCount: 1,
    typedCount: 0
  }
];

describe("history selection", () => {
  it("toggles selected history rows and returns selected urls in visible order", () => {
    const selected = toggleHistorySelection(toggleHistorySelection(new Set<string>(), "b"), "a");

    expect(selectedHistoryUrls(records, selected)).toEqual(["https://a.example/", "https://b.example/"]);
    expect([...toggleHistorySelection(selected, "a")]).toEqual(["b"]);
  });

  it("selects all visible rows and prunes stale selections", () => {
    const selected = selectAllHistory(records);

    expect([...selected]).toEqual(["a", "b"]);
    expect([...pruneHistorySelection([records[1]], selected)]).toEqual(["b"]);
  });
});
