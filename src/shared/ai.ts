import type { AiMatch, AiProvider, AiQueryBatchError, AiQueryDebug, AiQueryOptions, HistoryRecord } from "./types";
import { sanitizeUrlForAi } from "./url";

export interface AiChatRequest {
  endpoint: string;
  body: {
    model: string;
    temperature: number;
    response_format: { type: "json_object" };
    messages: Array<{ role: "system" | "user"; content: string }>;
  };
}

export const DEFAULT_AI_HISTORY_BATCH_SIZE = 1000;
export const DEFAULT_AI_HISTORY_MAX_CONCURRENCY = 8;

interface BatchedAiMatchOptions {
  batchSize?: number;
  continueOnBatchError?: boolean;
  maxConcurrency?: number;
}

export class AiOutputParseError extends Error {
  constructor(public readonly snippet: string) {
    super(`模型返回的不是 JSON：${snippet}`);
    this.name = "AiOutputParseError";
  }
}

interface CurrentTimeContext {
  iso: string;
  localDate: string;
  localDateTime: string;
  timeZone: string;
}

export function aiEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

export function buildAiRecordPayload(records: HistoryRecord[], options: AiQueryOptions) {
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    url: compactUrlForAi(sanitizeUrlForAi(record.url, options.includeQueryStrings)),
    lastVisitTime: new Date(record.lastVisitTime).toISOString(),
    visitCount: record.visitCount,
    typedCount: record.typedCount
  }));
}

function compactUrlForAi(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

function localDateParts(now: Date, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("zh-CN", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
}

function buildCurrentTimeContext(now = new Date()): CurrentTimeContext {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const parts = localDateParts(now, timeZone);
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    iso: now.toISOString(),
    localDate,
    localDateTime: `${localDate} ${parts.hour}:${parts.minute}:${parts.second}`,
    timeZone
  };
}

export function buildAiChatRequest(
  provider: AiProvider,
  query: string,
  records: HistoryRecord[],
  options: AiQueryOptions & { temperature: number; now?: Date }
): AiChatRequest {
  const system = [
    "你是一个浏览器历史记录的语义匹配助手。你的任务是根据用户的自然语言描述，从提供的历史记录列表中找出相关或潜在相关的网页。",
    "请运用概念联想能力进行“语义桥接”，而非仅仅依赖字面的关键词匹配。",
    "",
    "【匹配原则】",
    "1. 意图推演：分析用户寻找的核心意图及其可能隶属的领域。如果记录的标题或 URL 包含与用户意图逻辑相关的元素（如同义词、关联品牌、行业概念），即使字面无重合也应视为命中。",
    "2. 记忆容错：考虑到用户对网页内容的记忆可能模糊或存在事实偏差，只要历史记录在逻辑上能与用户意图产生合理的交集，即视为潜在命中。",
    "3. 时间容错：当用户描述中包含时间线索时，请以输入的 `currentTime` 为参考基准进行推算。请注意，用户记忆的时间往往不够准确，匹配时需允许合理的误差范围，不要因为时间维度的轻微不符而排除语义上高度疑似的记录。",
    "4. 召回优先：可以包含弱关联记录以保持较高的召回率，不要遗漏潜在的匹配可能。",
    "",
    "【输出格式要求】",
    "1. 请只输出 JSON 格式数据，不要包含任何解释、分析或多余的文本。",
    "2. JSON 结构严格如下：{\"matches\":[{\"id\":\"真实的history_id\",\"confidence\":0.85}]}",
    "3. confidence 代表置信度（0.1 到 1.0）。强直接关联且时间相符给高分，弱泛化联想或时间偏差较大给低分。",
    "4. 请仅使用输入数据中提供的 ID。如果完全没有潜在关联的记录，请返回 {\"matches\":[]}。"
  ].join("\n");

  const user = JSON.stringify({
    currentTime: buildCurrentTimeContext(options.now),
    query,
    records: buildAiRecordPayload(records, options)
  });

  return {
    endpoint: aiEndpoint(provider.baseUrl),
    body: {
      model: provider.model,
      temperature: options.temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    }
  };
}

export function extractJsonText(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

export function parseAiMatches(input: unknown): AiMatch[] {
  let parsed: unknown;
  try {
    parsed = typeof input === "string" ? JSON.parse(extractJsonText(input)) : input;
  } catch {
    const snippet = typeof input === "string" ? extractJsonText(input).replace(/\s+/g, " ").slice(0, 180) : String(input);
    throw new AiOutputParseError(snippet);
  }
  const parsedObject =
    parsed && typeof parsed === "object" ? (parsed as { matches?: unknown; results?: unknown }) : {};
  const rawMatches = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsedObject.matches)
      ? parsedObject.matches
      : Array.isArray(parsedObject.results)
        ? parsedObject.results
        : [];

  return rawMatches
    .map((match: { id?: unknown; confidence?: unknown }) => ({
      id: typeof match.id === "string" ? match.id : "",
      confidence: typeof match.confidence === "number" ? match.confidence : undefined
    }))
    .filter((match: AiMatch) => Boolean(match.id) && match.confidence !== 0);
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value < 1) return fallback;
  return Math.floor(value);
}

function splitRecords(records: HistoryRecord[], batchSize: number): HistoryRecord[][] {
  const batches: HistoryRecord[][] = [];
  for (let index = 0; index < records.length; index += batchSize) {
    batches.push(records.slice(index, index + batchSize));
  }
  return batches;
}

export async function runBatchedAiMatches(
  records: HistoryRecord[],
  loadMatches: (batch: HistoryRecord[], batchIndex: number) => Promise<AiMatch[]>,
  options: BatchedAiMatchOptions = {}
): Promise<AiMatch[]> {
  return (await runBatchedAiMatchResult(records, loadMatches, options)).matches;
}

export async function runBatchedAiMatchResult(
  records: HistoryRecord[],
  loadMatches: (batch: HistoryRecord[], batchIndex: number) => Promise<AiMatch[]>,
  options: BatchedAiMatchOptions = {}
): Promise<{ matches: AiMatch[]; debug: AiQueryDebug }> {
  const batchSize = positiveInteger(options.batchSize, DEFAULT_AI_HISTORY_BATCH_SIZE);
  const maxConcurrency = positiveInteger(options.maxConcurrency, DEFAULT_AI_HISTORY_MAX_CONCURRENCY);
  const batches = splitRecords(records, batchSize);
  const mergedMatches = new Map<string, { match: AiMatch; firstSeen: number }>();
  const batchErrors: AiQueryBatchError[] = [];
  const batchReturnedCounts = batches.map(() => 0);
  let returnedMatchCount = 0;
  let nextBatchIndex = 0;
  let nextMatchIndex = 0;

  async function worker() {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      let matches: AiMatch[];
      try {
        matches = await loadMatches(batches[batchIndex], batchIndex);
      } catch (error) {
        if (!options.continueOnBatchError) throw error;
        batchErrors.push({
          batchIndex,
          batchSize: batches[batchIndex].length,
          message: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
      batchReturnedCounts[batchIndex] = matches.length;
      returnedMatchCount += matches.length;

      for (const match of matches) {
        if (!match.id || match.confidence === 0) continue;
        const previous = mergedMatches.get(match.id);
        if (!previous) {
          mergedMatches.set(match.id, { match, firstSeen: nextMatchIndex });
          nextMatchIndex += 1;
          continue;
        }

        if ((match.confidence ?? 0) > (previous.match.confidence ?? 0)) {
          previous.match = match;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(maxConcurrency, batches.length) }, () => worker()));

  const matches = Array.from(mergedMatches.values())
    .sort((a, b) => (b.match.confidence ?? 0) - (a.match.confidence ?? 0) || a.firstSeen - b.firstSeen)
    .map((entry) => entry.match);

  return {
    matches,
    debug: {
      candidateCount: records.length,
      batchSize,
      maxConcurrency,
      batchCount: batches.length,
      batchReturnedCounts,
      returnedMatchCount,
      uniqueMatchCount: mergedMatches.size,
      batchErrors
    }
  };
}

export function rankRecordsByAiMatches(records: HistoryRecord[], matches: AiMatch[]): HistoryRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return matches
    .map((match, index) => ({ match, index, record: byId.get(match.id) }))
    .filter((entry): entry is { match: AiMatch; index: number; record: HistoryRecord } => Boolean(entry.record))
    .sort((a, b) => (b.match.confidence ?? 0) - (a.match.confidence ?? 0) || a.index - b.index)
    .map((entry) => entry.record);
}
