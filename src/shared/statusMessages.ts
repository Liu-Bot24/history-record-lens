export const AI_QUERY_FAILURE_NOTE =
  "*If browsing history contains sensitive information, some models may reject the request because of content safety policies. Try cleaning those records or using another model.";

export function formatAiQueryFailureStatus(message: string): string {
  return `${message}\n${AI_QUERY_FAILURE_NOTE}`;
}
