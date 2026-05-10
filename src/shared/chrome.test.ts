import { describe, expect, it } from "vitest";
import { buildHistorySearchQuery } from "./chrome";

describe("Chrome history query", () => {
  it("does not pass maxResults 0 to the History API", () => {
    const query = buildHistorySearchQuery({ text: "" });

    expect(query.startTime).toBe(0);
    expect(query.maxResults).toBeGreaterThan(0);
  });

  it("keeps explicit positive maxResults", () => {
    const query = buildHistorySearchQuery({ text: "camera", maxResults: 25 });

    expect(query.text).toBe("camera");
    expect(query.maxResults).toBe(25);
  });
});
