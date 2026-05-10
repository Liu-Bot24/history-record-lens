import { describe, expect, it } from "vitest";
import {
  buildAiChatRequest,
  buildAiRecordPayload,
  parseAiMatches,
  rankRecordsByAiMatches,
  runBatchedAiMatches,
  runBatchedAiMatchResult,
  AiOutputParseError
} from "./ai";
import type { AiProvider, HistoryRecord } from "./types";

const provider: AiProvider = {
  id: "p1",
  name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "secret",
  model: "gpt-test",
  enabled: true,
  isDefault: true
};

const records: HistoryRecord[] = [
  {
    id: "h_a",
    title: "Photography guide",
    url: "https://camera.example.com/posts/model-alpha?ref=secret",
    host: "camera.example.com",
    path: "/posts/model-alpha",
    lastVisitTime: 100,
    visitCount: 2,
    typedCount: 0
  },
  {
    id: "h_b",
    title: "Browser history docs",
    url: "https://developer.chrome.com/docs/extensions/reference/api/history",
    host: "developer.chrome.com",
    path: "/docs/extensions/reference/api/history",
    lastVisitTime: 200,
    visitCount: 1,
    typedCount: 1
  }
];

function makeRecords(count: number): HistoryRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `h_${index}`,
    title: `Record ${index}`,
    url: `https://example.com/${index}`,
    host: "example.com",
    path: `/${index}`,
    lastVisitTime: index,
    visitCount: 1,
    typedCount: 0
  }));
}

describe("AI helpers", () => {
  it("builds a JSON-only chat completion request", () => {
    const request = buildAiChatRequest(provider, "camera parameter", records, {
      includeQueryStrings: true,
      temperature: 0,
      now: new Date("2026-05-10T04:00:00.000Z")
    });
    const systemPrompt = request.body.messages[0].content;

    expect(request.endpoint).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.body.model).toBe("gpt-test");
    expect(systemPrompt).toContain("不要包含任何解释、分析或多余的文本");
    expect(request.body.response_format.type).toBe("json_object");
  });

  it("uses the semantic bridge prompt with relative-time tolerance", () => {
    const request = buildAiChatRequest(provider, "camera parameter", records, {
      includeQueryStrings: true,
      temperature: 0,
      now: new Date("2026-05-10T04:00:00.000Z")
    });
    const systemPrompt = request.body.messages[0].content;

    expect(systemPrompt).toContain("浏览器历史记录的语义匹配助手");
    expect(systemPrompt).toContain("语义桥接");
    expect(systemPrompt).toContain("记忆容错");
    expect(systemPrompt).toContain("时间容错");
    expect(systemPrompt).toContain("召回优先");
    expect(systemPrompt).toContain("currentTime");
    expect(systemPrompt).toContain("不要因为时间维度的轻微不符而排除语义上高度疑似的记录");
    expect(systemPrompt).toContain("0.1 到 1.0");
    expect(systemPrompt).not.toContain("confidence\":0.0");
  });

  it("sends current time context so relative dates can be resolved", () => {
    const request = buildAiChatRequest(provider, "7 天前看过的字体网站", records, {
      includeQueryStrings: true,
      temperature: 0,
      now: new Date("2026-05-10T04:00:00.000Z")
    });
    const userPayload = JSON.parse(request.body.messages[1].content);

    expect(userPayload.currentTime.iso).toBe("2026-05-10T04:00:00.000Z");
    expect(userPayload.currentTime.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(userPayload.currentTime.timeZone).toBeTruthy();
  });

  it("can strip query strings from records", () => {
    const payload = buildAiRecordPayload(records, { includeQueryStrings: false });
    expect(payload[0].url).toBe("camera.example.com/posts/model-alpha");
  });

  it("sends one compact URL field instead of duplicating host and path", () => {
    const payload = buildAiRecordPayload(records, { includeQueryStrings: false });

    expect(payload[0]).toMatchObject({
      id: "h_a",
      title: "Photography guide",
      url: "camera.example.com/posts/model-alpha"
    });
    expect(payload[0]).not.toHaveProperty("host");
    expect(payload[0]).not.toHaveProperty("path");
  });

  it("parses model output with ids and confidence only", () => {
    expect(parseAiMatches('{"matches":[{"id":"h_b","confidence":0.9}]}')).toEqual([
      { id: "h_b", confidence: 0.9 }
    ]);
  });

  it("reports non-JSON model output with a readable snippet", () => {
    expect(() => parseAiMatches("The request was not valid JSON.")).toThrow(AiOutputParseError);
    expect(() => parseAiMatches("The request was not valid JSON.")).toThrow("模型返回的不是 JSON：The request");
  });

  it("ranks records by model confidence", () => {
    const ranked = rankRecordsByAiMatches(records, [
      { id: "h_a", confidence: 0.2 },
      { id: "h_b", confidence: 0.8 }
    ]);
    expect(ranked.map((record) => record.id)).toEqual(["h_b", "h_a"]);
  });

  it("drops only model matches with exactly zero confidence", () => {
    expect(
      parseAiMatches('{"matches":[{"id":"h_a","confidence":0},{"id":"h_b","confidence":0.01},{"id":"h_c"}]}')
    ).toEqual([
      { id: "h_b", confidence: 0.01 },
      { id: "h_c", confidence: undefined }
    ]);
  });

  it("runs AI matching in 1000-record batches with at most 8 concurrent requests", async () => {
    const manyRecords = makeRecords(9_001);
    const batchSizes: number[] = [];
    let active = 0;
    let maxActive = 0;

    const matches = await runBatchedAiMatches(manyRecords, async (batch, batchIndex) => {
      batchSizes.push(batch.length);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return [{ id: batch[0].id, confidence: (batchIndex + 1) / 100 }];
    });

    expect(batchSizes).toEqual([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1]);
    expect(maxActive).toBe(8);
    expect(matches).toHaveLength(10);
  });

  it("returns batching debug info for AI queries", async () => {
    const manyRecords = makeRecords(2_001);
    const result = await runBatchedAiMatchResult(manyRecords, async (batch, batchIndex) =>
      batchIndex === 0
        ? [
            { id: batch[0].id, confidence: 0.5 },
            { id: batch[1].id, confidence: 0.4 }
          ]
        : [{ id: batch[0].id, confidence: 0.3 }]
    );

    expect(result.debug).toEqual({
      candidateCount: 2001,
      batchSize: 1000,
      maxConcurrency: 8,
      batchCount: 3,
      batchReturnedCounts: [2, 1, 1],
      returnedMatchCount: 4,
      uniqueMatchCount: 4,
      batchErrors: []
    });
  });

  it("can continue batching and report failed batches", async () => {
    const manyRecords = makeRecords(2_001);
    const result = await runBatchedAiMatchResult(
      manyRecords,
      async (batch, batchIndex) => {
        if (batchIndex === 1) throw new Error("模型返回的不是 JSON：The request was invalid");
        return [{ id: batch[0].id, confidence: 0.5 }];
      },
      { continueOnBatchError: true }
    );

    expect(result.debug.batchReturnedCounts).toEqual([1, 0, 1]);
    expect(result.debug.batchErrors).toEqual([
      { batchIndex: 1, batchSize: 1000, message: "模型返回的不是 JSON：The request was invalid" }
    ]);
    expect(result.matches).toHaveLength(2);
  });
});
