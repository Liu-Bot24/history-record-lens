import { describe, expect, it } from "vitest";
import { AI_QUERY_FAILURE_NOTE, formatAiQueryFailureStatus } from "./statusMessages";

describe("status messages", () => {
  it("adds the large-model safety note below AI query failures", () => {
    expect(formatAiQueryFailureStatus("AI 查询有 1 批失败：模型拒绝回答")).toBe(
      `AI 查询有 1 批失败：模型拒绝回答\n${AI_QUERY_FAILURE_NOTE}`
    );
  });
});
