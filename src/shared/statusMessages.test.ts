import { describe, expect, it } from "vitest";
import { AI_QUERY_FAILURE_NOTE, formatAiQueryFailureStatus } from "./statusMessages";

describe("status messages", () => {
  it("adds the large-model safety note below AI query failures", () => {
    expect(formatAiQueryFailureStatus("AI query had 1 failed batch: model refused to answer")).toBe(
      `AI query had 1 failed batch: model refused to answer\n${AI_QUERY_FAILURE_NOTE}`
    );
  });
});
