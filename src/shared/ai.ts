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
    super(`Model returned non-JSON output: ${snippet}`);
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
    new Intl.DateTimeFormat("en-CA", {
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
    "You are a semantic matching assistant for browser history. Your task is to find relevant or potentially relevant pages from the provided history records based on the user's natural-language description.",
    "Use conceptual association for semantic bridging instead of relying only on literal keyword matches.",
    "",
    "Matching principles:",
    "1. Infer intent: analyze the user's core intent and the likely domain it belongs to. If a record title or URL contains elements logically related to that intent, such as synonyms, related brands, or industry concepts, treat it as a match even without exact wording overlap.",
    "2. Tolerate imperfect memory: the user's memory of page content may be vague or factually off. If a history record can reasonably intersect with the user's intent, treat it as a potential match.",
    "3. Tolerate time ambiguity: when the user includes time clues, use the input `currentTime` as the reference point. User memory of timing is often imprecise, so allow a reasonable error range and do not exclude semantically strong candidates because of a minor time mismatch.",
    "4. Prefer recall: include weakly related records when needed to maintain high recall. Do not miss plausible matches.",
    "",
    "Output format requirements:",
    "1. Output JSON only. Do not include explanations, analysis, or extra text.",
    "2. The JSON structure must be exactly: {\"matches\":[{\"id\":\"actual_history_id\",\"confidence\":0.85}]}",
    "3. confidence represents match confidence from 0.1 to 1.0. Give high scores to strong direct matches with consistent timing, and lower scores to weaker generalized associations or larger time mismatches.",
    "4. Use only IDs provided in the input data. If there are no potentially related records, return {\"matches\":[]}."
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
