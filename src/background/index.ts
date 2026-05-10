import { buildAiChatRequest, parseAiMatches, rankRecordsByAiMatches, runBatchedAiMatchResult } from "../shared/ai";
import { deleteHistoryUrls, searchHistory } from "../shared/chrome";
import { cleanupTimeRangeToFilter } from "../shared/cleanupTimeRange";
import { filterRecordsByRule, newId, ruleMatchesUrl } from "../shared/siteRules";
import {
  appendCleanupLog,
  getCleanupLog,
  getSettings,
  getSiteRules,
  saveSettings,
  saveSiteRules
} from "../shared/storage";
import type { BackgroundRequest, BackgroundResponse } from "../shared/messages";
import type { AiProvider, CleanupLogEntry, HistoryRecord, RuntimeTabSnapshot, SiteRule } from "../shared/types";

const tabIndex = new Map<number, RuntimeTabSnapshot>();

async function getDefaultProvider(providerId?: string): Promise<AiProvider> {
  const settings = await getSettings();
  const provider =
    settings.aiProviders.find((item) => item.id === providerId) ??
    settings.aiProviders.find((item) => item.id === settings.defaultProviderId) ??
    settings.aiProviders.find((item) => item.isDefault) ??
    settings.aiProviders[0];

  if (!provider) throw new Error("还没有配置模型服务。");
  if (!provider.apiKey.trim()) throw new Error("当前模型服务缺少 API Key。");
  if (!provider.baseUrl.trim()) throw new Error("当前模型服务缺少 API Base URL。");
  if (!provider.model.trim()) throw new Error("当前模型服务缺少模型名称。");
  return provider;
}

async function callProvider(provider: AiProvider, query: string, records: HistoryRecord[] = []) {
  const settings = await getSettings();
  const request = buildAiChatRequest(provider, query, records, {
    includeQueryStrings: settings.includeQueryStringsInAi,
    temperature: settings.aiTemperature
  });

  const response = await fetch(request.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify(request.body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 请求失败（${response.status}）：${text.slice(0, 240)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("模型服务返回了无法识别的响应。");
  return parseAiMatches(content);
}

async function getMatchingRuleIds(url: string, rules?: SiteRule[]) {
  const siteRules = rules ?? (await getSiteRules());
  return siteRules.filter((rule) => rule.cleanupEnabled && ruleMatchesUrl(rule, url)).map((rule) => rule.id);
}

async function rememberTab(tab: chrome.tabs.Tab) {
  if (!tab.id || !tab.url || !/^https?:\/\//i.test(tab.url)) return;
  const matchedRuleIds = await getMatchingRuleIds(tab.url);
  if (!matchedRuleIds.length) {
    tabIndex.delete(tab.id);
    return;
  }
  tabIndex.set(tab.id, {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url,
    matchedRuleIds,
    updatedAt: Date.now()
  });
}

async function rebuildTabIndex() {
  tabIndex.clear();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => rememberTab(tab)));
}

async function hasOpenMatchingTab(rule: SiteRule): Promise<boolean> {
  const tabs = await chrome.tabs.query({});
  return tabs.some((tab) => Boolean(tab.url && ruleMatchesUrl(rule, tab.url)));
}

async function cleanupRule(rule: SiteRule, trigger: CleanupLogEntry["trigger"]) {
  const settings = await getSettings();
  const records = filterRecordsByRule(
    await searchHistory({ text: "", maxResults: 0, ...cleanupTimeRangeToFilter(settings.cleanupTimeRange) }),
    rule
  );
  const deletedCount = await deleteHistoryUrls(records.map((record) => record.url));
  await appendCleanupLog({
    id: newId("cleanup"),
    ruleId: rule.id,
    ruleName: rule.name,
    deletedCount,
    createdAt: Date.now(),
    trigger
  });
  return { deletedCount };
}

async function cleanupAfterTabClose(ruleIds: string[]) {
  if (!ruleIds.length) return;
  const rules = await getSiteRules();
  for (const rule of rules.filter((item) => ruleIds.includes(item.id) && item.cleanupEnabled && item.enabled)) {
    const stillOpen = await hasOpenMatchingTab(rule);
    if (!stillOpen && rule.cleanupOnTabClose) await cleanupRule(rule, "tabClose");
  }
}

async function handleMessage(message: BackgroundRequest): Promise<unknown> {
  switch (message.type) {
    case "GET_SETTINGS":
      return getSettings();
    case "SAVE_SETTINGS":
      await saveSettings(message.settings);
      return message.settings;
    case "TEST_AI_PROVIDER": {
      const provider = await getDefaultProvider(message.providerId);
      await callProvider(provider, "Return no matches for this connection test.", []);
      return { ok: true };
    }
    case "GET_SITE_RULES":
      return getSiteRules();
    case "SAVE_SITE_RULES":
      await saveSiteRules(message.rules);
      await rebuildTabIndex();
      return message.rules;
    case "GET_ACTIVE_TAB": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https?:\/\//i.test(tab.url)) throw new Error("当前标签页不是可添加的网站。");
      return { title: tab.title ?? "", url: tab.url };
    }
    case "GET_CLEANUP_LOG":
      return getCleanupLog();
    case "SEARCH_HISTORY":
      return searchHistory(message.filter);
    case "DELETE_URLS":
      return { deletedCount: await deleteHistoryUrls(message.urls) };
    case "DELETE_FILTERED": {
      const records = await searchHistory(message.filter);
      return { deletedCount: await deleteHistoryUrls(records.map((record) => record.url)) };
    }
    case "OPEN_URL":
      await chrome.tabs.create({ url: message.url });
      return { opened: true };
    case "CLEAN_SITE_RULE": {
      const rules = await getSiteRules();
      const rule = rules.find((item) => item.id === message.ruleId);
      if (!rule) throw new Error("没有找到这个网站规则。");
      return cleanupRule(rule, "manual");
    }
    case "AI_QUERY": {
      const provider = await getDefaultProvider(message.providerId);
      const records = await searchHistory(message.filter);
      const result = await runBatchedAiMatchResult(records, (batch) => callProvider(provider, message.query, batch), {
        continueOnBatchError: true
      });
      const rankedRecords = rankRecordsByAiMatches(records, result.matches);
      return {
        matches: result.matches,
        records: rankedRecords,
        debug: { ...result.debug, validRecordCount: rankedRecords.length }
      };
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  rebuildTabIndex().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  rebuildTabIndex().catch(console.error);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || tab.url) rememberTab(tab).catch(console.error);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const snapshot = tabIndex.get(tabId);
  tabIndex.delete(tabId);
  if (snapshot) cleanupAfterTabClose(snapshot.matchedRuleIds).catch(console.error);
});

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data } satisfies BackgroundResponse))
    .catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : String(error);
      sendResponse({ ok: false, error: messageText } satisfies BackgroundResponse);
    });
  return true;
});
