import { describe, expect, it, vi } from "vitest";
import {
  AI_SORT_BY_CONFIDENCE_KEY,
  UI_LANGUAGE_KEY,
  detectBrowserLanguage,
  loadLanguagePreference,
  loadSortByConfidencePreference,
  saveLanguagePreference,
  saveSortByConfidencePreference
} from "./localPreferences";

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_: string, nextValue: string) => {
      value = nextValue;
    })
  };
}

describe("local preferences", () => {
  it("loads the AI confidence sorting preference from local storage", () => {
    expect(loadSortByConfidencePreference(memoryStorage("true"))).toBe(true);
    expect(loadSortByConfidencePreference(memoryStorage("false"))).toBe(false);
    expect(loadSortByConfidencePreference(memoryStorage(null))).toBe(false);
  });

  it("saves the AI confidence sorting preference as a local boolean string", () => {
    const storage = memoryStorage();

    saveSortByConfidencePreference(true, storage);
    expect(storage.setItem).toHaveBeenLastCalledWith(AI_SORT_BY_CONFIDENCE_KEY, "true");

    saveSortByConfidencePreference(false, storage);
    expect(storage.setItem).toHaveBeenLastCalledWith(AI_SORT_BY_CONFIDENCE_KEY, "false");
  });

  it("falls back quietly when local storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      })
    };

    expect(loadSortByConfidencePreference(storage)).toBe(false);
    expect(() => saveSortByConfidencePreference(true, storage)).not.toThrow();
  });

  it("defaults the UI language from browser languages when there is no saved preference", () => {
    expect(detectBrowserLanguage(["zh-CN", "en-US"])).toBe("zh");
    expect(detectBrowserLanguage(["en-US", "zh-CN"])).toBe("en");
    expect(detectBrowserLanguage(["fr-FR"])).toBe("en");
    expect(loadLanguagePreference(memoryStorage(null), ["zh-TW"])).toBe("zh");
  });

  it("loads and saves an explicit UI language preference", () => {
    const storage = memoryStorage("zh");

    expect(loadLanguagePreference(storage, ["en-US"])).toBe("zh");

    saveLanguagePreference("en", storage);
    expect(storage.setItem).toHaveBeenLastCalledWith(UI_LANGUAGE_KEY, "en");
    expect(loadLanguagePreference(storage, ["zh-CN"])).toBe("en");
  });
});
