export const AI_QUERY_FAILURE_NOTE =
  "*历史浏览记录中存在敏感信息时，可能触发部分大模型的内容安全审查而导致查询失败。建议清洗浏览记录或更换其他模型。";

export function formatAiQueryFailureStatus(message: string): string {
  return `${message}\n${AI_QUERY_FAILURE_NOTE}`;
}
