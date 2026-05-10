export const AI_SORT_BY_CONFIDENCE_KEY = "history-lens.ai.sortByConfidence";

type LocalPreferenceStorage = Pick<Storage, "getItem" | "setItem">;

function getLocalStorage(): LocalPreferenceStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadSortByConfidencePreference(storage = getLocalStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(AI_SORT_BY_CONFIDENCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveSortByConfidencePreference(value: boolean, storage = getLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(AI_SORT_BY_CONFIDENCE_KEY, value ? "true" : "false");
  } catch {
    // Browser privacy settings can block localStorage; the preference is optional.
  }
}
