import { Brain, Check, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Search, TestTube2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cleanupTimeRangeToFilter } from "../shared/cleanupTimeRange";
import { ensureApiHostPermission, reorderDefaultProvider, sendToBackground } from "../shared/client";
import { pruneHistorySelection, selectedHistoryUrls } from "../shared/historySelection";
import { loadSortByConfidencePreference, saveSortByConfidencePreference } from "../shared/localPreferences";
import { newId } from "../shared/siteRules";
import { formatAiQueryFailureStatus } from "../shared/statusMessages";
import type { AiProvider, AppSettings, CleanupTimeRange, HistoryFilter, HistoryRecord } from "../shared/types";
import { HistoryBulkActions, HistoryList } from "./HistoryPanel";

interface AiPanelProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  setStatus: (status: string) => void;
}

const timeRangeOptions: Array<{ mode: CleanupTimeRange["mode"]; label: string }> = [
  { mode: "all", label: "不限" },
  { mode: "hour", label: "最近一小时" },
  { mode: "day", label: "最近一天" },
  { mode: "week", label: "最近七天" }
];

const defaultProviderDraft: AiProvider = {
  id: "draft",
  name: "模型服务",
  baseUrl: "",
  apiKey: "",
  model: "",
  enabled: true,
  isDefault: true
};

function modelLabel(provider: AiProvider | undefined): string {
  return provider?.model.trim() || provider?.name.trim() || "未配置";
}

function cssPixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function useHistoryTitleLayout(selectedCount: number, recordCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !selectedCount) {
      setStacked(false);
      return;
    }

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const title = root.querySelector<HTMLElement>("[data-history-title-label]");
        const actions = root.querySelector<HTMLElement>("[data-history-bulk-actions]");
        const sort = root.querySelector<HTMLElement>("[data-history-sort]");
        if (!title || !actions || !sort) {
          setStacked(false);
          return;
        }

        const wasStacked = root.classList.contains("is-stacked");
        if (wasStacked) root.classList.remove("is-stacked");
        const rootStyle = window.getComputedStyle(root);
        const actionStyle = window.getComputedStyle(actions);
        const rootGap = cssPixelValue(rootStyle.columnGap || rootStyle.gap);
        const actionGap = cssPixelValue(actionStyle.columnGap || actionStyle.gap);
        const actionItems = Array.from(actions.children) as HTMLElement[];
        const actionWidth =
          actionItems.reduce((total, item) => total + item.scrollWidth, 0) +
          Math.max(0, actionItems.length - 1) * actionGap;
        const requiredWidth =
          title.getBoundingClientRect().width + actionWidth + sort.scrollWidth + rootGap * 2;
        if (wasStacked) root.classList.add("is-stacked");

        setStacked((current) => {
          const next = requiredWidth > root.getBoundingClientRect().width + 0.5;
          return current === next ? current : next;
        });
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (root.parentElement) observer.observe(root.parentElement);
    const actions = root.querySelector<HTMLElement>("[data-history-bulk-actions]");
    if (actions) observer.observe(actions);
    const interval = window.setInterval(measure, 150);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [recordCount, selectedCount]);

  return { ref, stacked };
}

export function AiPanel({ settings, setSettings, setStatus }: AiPanelProps) {
  const selectedProvider = useMemo(
    () =>
      settings.aiProviders.find((provider) => provider.id === settings.defaultProviderId) ??
      settings.aiProviders.find((provider) => provider.isDefault) ??
      settings.aiProviders[0],
    [settings.aiProviders, settings.defaultProviderId]
  );
  const [editingProviderId, setEditingProviderId] = useState(selectedProvider?.id ?? "draft");
  const [providerDraft, setProviderDraft] = useState<AiProvider>(selectedProvider ?? defaultProviderDraft);
  const [isCreatingProvider, setIsCreatingProvider] = useState(false);
  const [exactText, setExactText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [timeRange, setTimeRange] = useState<CleanupTimeRange>({ mode: "all" });
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortByConfidence, setSortByConfidence] = useState(loadSortByConfidencePreference);
  const [modelOpen, setModelOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modelFeedback, setModelFeedback] = useState<{ tone: "success" | "error" | "neutral"; text: string } | null>(null);

  useEffect(() => {
    if (editingProviderId === "draft") {
      if (selectedProvider && !isCreatingProvider) {
        setEditingProviderId(selectedProvider.id);
        setProviderDraft(selectedProvider);
      }
      return;
    }
    const provider = settings.aiProviders.find((item) => item.id === editingProviderId) ?? selectedProvider;
    if (!provider) {
      setEditingProviderId("draft");
      setProviderDraft(defaultProviderDraft);
      return;
    }
    setEditingProviderId(provider.id);
    setProviderDraft(provider);
  }, [editingProviderId, isCreatingProvider, selectedProvider, settings.aiProviders]);

  const activeProvider = providerDraft;
  const exactFilter = useMemo(
    () => ({
      text: exactText.trim(),
      ...cleanupTimeRangeToFilter(timeRange)
    }),
    [exactText, timeRange]
  );
  const sortedRecords = useMemo(() => {
    if (sortByConfidence) return records;
    return [...records].sort((a, b) => b.lastVisitTime - a.lastVisitTime);
  }, [records, sortByConfidence]);
  const selectedUrls = useMemo(() => selectedHistoryUrls(sortedRecords, selected), [selected, sortedRecords]);
  const historyTitleLayout = useHistoryTitleLayout(selectedUrls.length, sortedRecords.length);

  useEffect(() => {
    setSelected((previous) => pruneHistorySelection(sortedRecords, previous));
  }, [sortedRecords]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      sendToBackground({ type: "SEARCH_HISTORY", filter: exactFilter as HistoryFilter })
        .then((nextRecords) => {
          if (!cancelled) {
            setRecords(nextRecords);
          }
        })
        .catch((error: Error) => {
          if (!cancelled) setStatus(error.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [exactFilter, setStatus]);

  async function saveProvider(feedbackText = "模型配置已保存"): Promise<AiProvider | null> {
    const existingProvider = settings.aiProviders.find((item) => item.id === activeProvider.id && activeProvider.id !== "draft");
    const provider: AiProvider = {
      ...activeProvider,
      id: existingProvider?.id ?? newId("provider"),
      name: activeProvider.model.trim() || activeProvider.name.trim() || "模型服务",
      baseUrl: activeProvider.baseUrl.trim(),
      apiKey: activeProvider.apiKey.trim(),
      model: activeProvider.model.trim(),
      enabled: true,
      isDefault: true
    };

    const nextProviders = existingProvider
      ? settings.aiProviders.map((item) => (item.id === provider.id ? provider : { ...item, isDefault: false }))
      : [...settings.aiProviders.map((item) => ({ ...item, isDefault: false })), provider];
    const nextSettings = reorderDefaultProvider({ ...settings, aiProviders: nextProviders, defaultProviderId: provider.id }, provider.id);
    const allowed = await ensureApiHostPermission(nextSettings, provider.id);
    if (!allowed) {
      setModelFeedback({ tone: "error", text: "没有授予 API 域名访问权限" });
      return null;
    }
    setSettings(nextSettings);
    setEditingProviderId(provider.id);
    setIsCreatingProvider(false);
    setProviderDraft(provider);
    await sendToBackground({ type: "SAVE_SETTINGS", settings: nextSettings });
    setStatus("");
    setModelFeedback({ tone: "success", text: feedbackText });
    return provider;
  }

  async function testProvider() {
    const provider = await saveProvider("正在测试连接...");
    if (!provider) return;
    setModelFeedback({ tone: "neutral", text: "正在测试连接..." });
    try {
      await sendToBackground({ type: "TEST_AI_PROVIDER", providerId: provider.id });
      setModelFeedback({ tone: "success", text: "连接测试通过" });
    } catch (error) {
      setModelFeedback({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }

  async function runAiQuery() {
    if (!prompt.trim()) return;
    const provider =
      settings.aiProviders.find((item) => item.id === editingProviderId) ??
      selectedProvider ??
      (await saveProvider());
    if (!provider) return;
    setLoading(true);
    setStatus("");
    try {
      const result = await sendToBackground({ type: "AI_QUERY", providerId: provider.id, query: prompt, filter: exactFilter as HistoryFilter });
      setRecords(result.records);
      setSelected(new Set());
      if (result.debug.batchErrors.length) {
        setStatus(formatAiQueryFailureStatus(`AI 查询有 ${result.debug.batchErrors.length} 批失败：${result.debug.batchErrors[0].message}`));
      }
    } catch (error) {
      setStatus(formatAiQueryFailureStatus(error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  }

  function patchProviderDraft(patch: Partial<AiProvider>) {
    setProviderDraft((value) => ({ ...value, ...patch }));
  }

  async function selectProvider(provider: AiProvider) {
    setEditingProviderId(provider.id);
    setIsCreatingProvider(false);
    setProviderDraft(provider);
    setModelFeedback(null);
    setShowKey(false);
    if (provider.id === settings.defaultProviderId) return;
    const nextSettings = reorderDefaultProvider(settings, provider.id);
    setSettings(nextSettings);
    try {
      await sendToBackground({ type: "SAVE_SETTINGS", settings: nextSettings });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function addProviderDraft() {
    setEditingProviderId("draft");
    setIsCreatingProvider(true);
    setProviderDraft(defaultProviderDraft);
    setModelFeedback(null);
    setShowKey(false);
    setModelOpen(true);
  }

  function updateSortByConfidence(value: boolean) {
    setSortByConfidence(value);
    saveSortByConfidencePreference(value);
  }

  async function openSelectedRecords() {
    if (!selectedUrls.length) return;
    setLoading(true);
    try {
      await Promise.all(selectedUrls.map((url) => sendToBackground({ type: "OPEN_URL", url })));
      setStatus(`已打开 ${selectedUrls.length} 条历史记录`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedRecords() {
    if (!selectedUrls.length) return;
    setLoading(true);
    try {
      const result = await sendToBackground({ type: "DELETE_URLS", urls: selectedUrls });
      setStatus(`已删除 ${result.deletedCount} 条 URL 历史`);
      setRecords((previous) => previous.filter((record) => !selected.has(record.id)));
      setSelected(new Set());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel ai-unified-panel">
      <div className="history-query-strip">
        <div className="exact-search-line">
          <div className="search-input-wrap">
            <Search size={15} />
            <input
              value={exactText}
              onChange={(event) => setExactText(event.target.value)}
              placeholder="搜索历史记录"
            />
          </div>
        </div>

        <div className="time-chip-row">
          {timeRangeOptions.map((option) => (
            <button
              className={timeRange.mode === option.mode ? "time-chip is-active" : "time-chip"}
              key={option.mode}
              onClick={() => setTimeRange((value) => ({ ...value, mode: option.mode }))}
              type="button"
            >
              {option.label}
            </button>
          ))}
          <input
            aria-label="开始日期"
            type="date"
            value={timeRange.startDate ?? ""}
            onChange={(event) => setTimeRange((value) => ({ ...value, mode: "custom", startDate: event.target.value }))}
          />
          <input
            aria-label="结束日期"
            type="date"
            value={timeRange.endDate ?? ""}
            onChange={(event) => setTimeRange((value) => ({ ...value, mode: "custom", endDate: event.target.value }))}
          />
        </div>

        <div className="ai-prompt-line">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runAiQuery();
            }}
            placeholder="前几天看过一个工具或教程网页，想不起来名字了。"
          />
          <button className="primary" onClick={runAiQuery} disabled={loading || !prompt.trim()} type="button">
            <Brain size={15} />
            AI 查询
          </button>
        </div>

        <section className="model-fold">
          <button className="model-fold-title" onClick={() => setModelOpen((value) => !value)} type="button">
            <span>模型配置</span>
            <small>{modelLabel(activeProvider)}</small>
            {modelOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {modelOpen ? (
            <div className="model-config-grid">
              <div className="model-tabs-row" aria-label="模型服务">
                {settings.aiProviders.map((provider) => (
                  <button
                    className={editingProviderId === provider.id ? "model-tab is-active" : "model-tab"}
                    key={provider.id}
                    onClick={() => void selectProvider(provider)}
                    title={modelLabel(provider)}
                    type="button"
                  >
                    {modelLabel(provider)}
                  </button>
                ))}
                {editingProviderId === "draft" ? (
                  <button className="model-tab is-active" type="button">
                    新模型
                  </button>
                ) : null}
                <button className="model-add-tab" onClick={addProviderDraft} title="添加模型" type="button">
                  <Plus size={14} />
                </button>
              </div>
              <input
                value={activeProvider.baseUrl}
                onChange={(event) => patchProviderDraft({ baseUrl: event.target.value })}
                placeholder="API 接口，例如 https://api.openai.com/v1"
              />
              <div className="secret-row compact">
                <input
                  type={showKey ? "text" : "password"}
                  value={activeProvider.apiKey}
                  onChange={(event) => patchProviderDraft({ apiKey: event.target.value })}
                  placeholder="API Key"
                />
                <button onClick={() => setShowKey((value) => !value)} type="button" title={showKey ? "隐藏" : "显示"}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input
                value={activeProvider.model}
                onChange={(event) => patchProviderDraft({ model: event.target.value })}
                placeholder="模型名称，例如 gpt-4.1-mini"
              />
              <div className="model-config-actions">
                <button className="primary" onClick={() => saveProvider()} type="button">
                  <Check size={14} />
                  保存
                </button>
                <button onClick={testProvider} type="button">
                  <TestTube2 size={14} />
                  测试
                </button>
                {modelFeedback ? (
                  <span className={`connection-indicator is-${modelFeedback.tone}`}>
                    <span />
                    {modelFeedback.text}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div
        className={historyTitleLayout.stacked ? "history-results-title is-stacked" : "history-results-title"}
        ref={historyTitleLayout.ref}
      >
        <span data-history-title-label="true">历史记录</span>
        <HistoryBulkActions
          records={sortedRecords}
          selected={selected}
          setSelected={setSelected}
          loading={loading}
          onOpenSelected={openSelectedRecords}
          onDeleteSelected={deleteSelectedRecords}
        />
        <label className="confidence-switch" data-history-sort="true">
          <input checked={sortByConfidence} onChange={(event) => updateSortByConfidence(event.target.checked)} type="checkbox" />
          <span>按置信度排序</span>
        </label>
      </div>
      <HistoryList records={sortedRecords} selected={selected} setSelected={setSelected} setStatus={setStatus} />
    </section>
  );
}
