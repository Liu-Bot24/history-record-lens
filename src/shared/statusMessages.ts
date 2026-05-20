import type { UiLanguage } from "./i18n";

export const AI_QUERY_FAILURE_NOTE =
  "*If browsing history contains sensitive information, some models may reject the request because of content safety policies. Try cleaning those records or using another model.";
export const AI_QUERY_FAILURE_NOTE_ZH =
  "*历史浏览记录中存在敏感信息时，可能触发部分大模型的内容安全审查而导致查询失败。建议清洗浏览记录或更换其他模型。";

export function formatAiQueryFailureStatus(message: string, language: UiLanguage = "en"): string {
  return `${message}\n${language === "zh" ? AI_QUERY_FAILURE_NOTE_ZH : AI_QUERY_FAILURE_NOTE}`;
}
