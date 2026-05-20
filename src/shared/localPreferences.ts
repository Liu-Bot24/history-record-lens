export const AI_SORT_BY_CONFIDENCE_KEY = "history-lens.ai.sortByConfidence";
export const UI_LANGUAGE_KEY = "history-lens.ui.language";

export type UiLanguage = "zh" | "en";

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

function getBrowserLanguages(): readonly string[] {
  const navigatorLanguages = globalThis.navigator?.languages;
  if (navigatorLanguages?.length) return navigatorLanguages;
  const navigatorLanguage = globalThis.navigator?.language;
  return navigatorLanguage ? [navigatorLanguage] : [];
}

export function detectBrowserLanguage(languages: readonly string[] = getBrowserLanguages()): UiLanguage {
  const firstSupported = languages.find((language) => /^zh\b|^zh-/i.test(language) || /^en\b|^en-/i.test(language));
  return firstSupported?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function loadLanguagePreference(storage = getLocalStorage(), languages = getBrowserLanguages()): UiLanguage {
  if (storage) {
    try {
      const value = storage.getItem(UI_LANGUAGE_KEY);
      if (value === "zh" || value === "en") return value;
    } catch {
      // Browser privacy settings can block localStorage; fall back to browser language.
    }
  }
  return detectBrowserLanguage(languages);
}

export function saveLanguagePreference(language: UiLanguage, storage = getLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(UI_LANGUAGE_KEY, language);
  } catch {
    // Browser privacy settings can block localStorage; the preference is optional.
  }
}
