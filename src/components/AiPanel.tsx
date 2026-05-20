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
  { mode: "all", label: "All time" },
  { mode: "hour", label: "Past hour" },
  { mode: "day", label: "Past day" },
  { mode: "week", label: "Past week" }
];

const defaultProviderDraft: AiProvider = {
  id: "draft",
  name: "Model Service",
  baseUrl: "",
  apiKey: "",
  model: "",
  enabled: true,
  isDefault: true
};

function modelLabel(provider: AiProvider | undefined): string {
  return provider?.model.trim() || provider?.name.trim() || "Not configured";
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

  async function saveProvider(feedbackText = "Model settings saved"): Promise<AiProvider | null> {
    const existingProvider = settings.aiProviders.find((item) => item.id === activeProvider.id && activeProvider.id !== "draft");
    const provider: AiProvider = {
      ...activeProvider,
      id: existingProvider?.id ?? newId("provider"),
      name: activeProvider.model.trim() || activeProvider.name.trim() || "Model Service",
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
      setModelFeedback({ tone: "error", text: "API domain access was not granted" });
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
    const provider = await saveProvider("Testing connection...");
    if (!provider) return;
    setModelFeedback({ tone: "neutral", text: "Testing connection..." });
    try {
      await sendToBackground({ type: "TEST_AI_PROVIDER", providerId: provider.id });
      setModelFeedback({ tone: "success", text: "Connection test passed" });
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
        setStatus(formatAiQueryFailureStatus(`AI query had ${result.debug.batchErrors.length} failed batch(es): ${result.debug.batchErrors[0].message}`));
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
      setStatus(`Opened ${selectedUrls.length} history record(s)`);
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
      setStatus(`Deleted ${result.deletedCount} URL history entr${result.deletedCount === 1 ? "y" : "ies"}`);
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
              placeholder="Search history"
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
            aria-label="Start date"
            className="date-input"
            inputMode="numeric"
            pattern="\d{4}-\d{2}-\d{2}"
            placeholder="YYYY-MM-DD"
            type="text"
            value={timeRange.startDate ?? ""}
            onChange={(event) => setTimeRange((value) => ({ ...value, mode: "custom", startDate: event.target.value }))}
          />
          <input
            aria-label="End date"
            className="date-input"
            inputMode="numeric"
            pattern="\d{4}-\d{2}-\d{2}"
            placeholder="YYYY-MM-DD"
            type="text"
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
            placeholder="I saw a tool or tutorial page a few days ago but can't remember its name."
          />
          <button className="primary" onClick={runAiQuery} disabled={loading || !prompt.trim()} type="button">
            <Brain size={15} />
            AI Query
          </button>
        </div>

        <section className="model-fold">
          <button className="model-fold-title" onClick={() => setModelOpen((value) => !value)} type="button">
            <span>Model Settings</span>
            <small>{modelLabel(activeProvider)}</small>
            {modelOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {modelOpen ? (
            <div className="model-config-grid">
              <div className="model-tabs-row" aria-label="Model services">
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
                    New Model
                  </button>
                ) : null}
                <button className="model-add-tab" onClick={addProviderDraft} title="Add model" type="button">
                  <Plus size={14} />
                </button>
              </div>
              <input
                value={activeProvider.baseUrl}
                onChange={(event) => patchProviderDraft({ baseUrl: event.target.value })}
                placeholder="API endpoint, e.g. https://api.openai.com/v1"
              />
              <div className="secret-row compact">
                <input
                  type={showKey ? "text" : "password"}
                  value={activeProvider.apiKey}
                  onChange={(event) => patchProviderDraft({ apiKey: event.target.value })}
                  placeholder="API Key"
                />
                <button onClick={() => setShowKey((value) => !value)} type="button" title={showKey ? "Hide" : "Show"}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input
                value={activeProvider.model}
                onChange={(event) => patchProviderDraft({ model: event.target.value })}
                placeholder="Model name, e.g. gpt-4.1-mini"
              />
              <div className="model-config-actions">
                <button className="primary" onClick={() => saveProvider()} type="button">
                  <Check size={14} />
                  Save
                </button>
                <button onClick={testProvider} type="button">
                  <TestTube2 size={14} />
                  Test
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
        <span data-history-title-label="true">History</span>
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
          <span>Sort by confidence</span>
        </label>
      </div>
      <HistoryList records={sortedRecords} selected={selected} setSelected={setSelected} setStatus={setStatus} />
    </section>
  );
}
