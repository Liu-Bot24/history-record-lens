import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPattern, createSiteRule } from "../shared/siteRules";
import { DEFAULT_SETTINGS } from "../shared/types";
import type { SiteRule } from "../shared/types";

type Listener = (...args: any[]) => void;

function createStorageArea(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys == null) return { ...data };
      if (typeof keys === "string") return { [keys]: data[keys] };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, data[key]]));
      return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, data[key] ?? fallback]));
    },
    async set(values: Record<string, unknown>) {
      Object.assign(data, values);
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    }
  };
}

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function youtubeRule(): SiteRule {
  return createSiteRule({
    id: "site_youtube",
    name: "YouTube",
    homeUrl: "https://www.youtube.com/",
    patterns: [createPattern("domain", "youtube.com")],
    cleanupEnabled: true,
    cleanupOnTabClose: true
  });
}

function installChromeMock(rule = youtubeRule()) {
  const listeners = {
    installed: [] as Listener[],
    startup: [] as Listener[],
    message: [] as Listener[],
    updated: [] as Listener[],
    removed: [] as Listener[]
  };
  const deletedUrls: string[] = [];
  const local = createStorageArea({
    settings: DEFAULT_SETTINGS,
    siteRules: [rule],
    cleanupLog: []
  });
  const session = createStorageArea();
  let openTabs: Array<Partial<chrome.tabs.Tab>> = [];

  vi.stubGlobal("chrome", {
    runtime: {
      onInstalled: { addListener: (listener: Listener) => listeners.installed.push(listener) },
      onStartup: { addListener: (listener: Listener) => listeners.startup.push(listener) },
      onMessage: { addListener: (listener: Listener) => listeners.message.push(listener) }
    },
    sidePanel: {
      setPanelBehavior: vi.fn().mockResolvedValue(undefined)
    },
    storage: { local, session },
    tabs: {
      query: vi.fn(async () => openTabs),
      create: vi.fn(),
      onUpdated: { addListener: (listener: Listener) => listeners.updated.push(listener) },
      onRemoved: { addListener: (listener: Listener) => listeners.removed.push(listener) }
    },
    history: {
      search: vi.fn(async () => [
        {
          id: "1",
          title: "YouTube video",
          url: "https://www.youtube.com/watch?v=abc",
          lastVisitTime: Date.now(),
          visitCount: 1,
          typedCount: 0
        },
        {
          id: "2",
          title: "YouTube home",
          url: "https://www.youtube.com/",
          lastVisitTime: Date.now() - 1000,
          visitCount: 1,
          typedCount: 0
        },
        {
          id: "3",
          title: "Example",
          url: "https://example.com/",
          lastVisitTime: Date.now() - 2000,
          visitCount: 1,
          typedCount: 0
        }
      ]),
      deleteUrl: vi.fn(async ({ url }: { url: string }) => {
        deletedUrls.push(url);
      })
    }
  });

  return {
    deletedUrls,
    listeners,
    local,
    session,
    setOpenTabs: (tabs: Array<Partial<chrome.tabs.Tab>>) => {
      openTabs = tabs;
    }
  };
}

async function importBackground() {
  vi.resetModules();
  await import("./index");
}

describe("background auto cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cleans a closed matching tab after the service worker restarts", async () => {
    const chromeMock = installChromeMock();
    await importBackground();

    chromeMock.listeners.updated.at(-1)?.(7, { url: "https://www.youtube.com/watch?v=abc" }, {
      id: 7,
      windowId: 1,
      url: "https://www.youtube.com/watch?v=abc"
    });
    await flushAsyncWork();

    await importBackground();
    chromeMock.setOpenTabs([]);
    chromeMock.listeners.removed.at(-1)?.(7, { isWindowClosing: false, windowId: 1 });
    await flushAsyncWork();

    expect(chromeMock.deletedUrls).toEqual(["https://www.youtube.com/watch?v=abc", "https://www.youtube.com/"]);
  });

  it("replays pending automatic cleanup on browser startup", async () => {
    const chromeMock = installChromeMock();
    await importBackground();

    chromeMock.listeners.updated.at(-1)?.(8, { url: "https://www.youtube.com/watch?v=abc" }, {
      id: 8,
      windowId: 1,
      url: "https://www.youtube.com/watch?v=abc"
    });
    await flushAsyncWork();

    for (const key of Object.keys(chromeMock.session.data)) delete chromeMock.session.data[key];
    await importBackground();
    chromeMock.setOpenTabs([]);
    chromeMock.listeners.startup.at(-1)?.();
    await flushAsyncWork();

    expect(chromeMock.deletedUrls).toEqual(["https://www.youtube.com/watch?v=abc", "https://www.youtube.com/"]);
  });
});
