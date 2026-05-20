import { ExternalLink, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { sendToBackground } from "../shared/client";
import { formatHistoryTime, historyEntryWord } from "../shared/i18n";
import type { Translator, UiLanguage } from "../shared/i18n";
import {
  pruneHistorySelection,
  selectAllHistory,
  selectedHistoryRecords,
  selectedHistoryUrls,
  toggleHistorySelection
} from "../shared/historySelection";
import type { HistoryFilter, HistoryRecord } from "../shared/types";
import { cleanUrlPattern, extractHost } from "../shared/url";

interface HistoryPanelProps {
  language: UiLanguage;
  t: Translator;
  setStatus: (status: string) => void;
}

export function HistoryPanel({ language, t, setStatus }: HistoryPanelProps) {
  const [filter, setFilter] = useHistoryFilter();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const selectedUrls = useMemo(() => selectedHistoryUrls(records, selected), [records, selected]);

  async function runSearch() {
    setLoading(true);
    setStatus("");
    try {
      const nextRecords = await sendToBackground({ type: "SEARCH_HISTORY", filter });
      setRecords(nextRecords);
      setSelected(new Set());
      setStatus(t("history.found", { count: nextRecords.length }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteUrls(urls: string[]) {
    if (!urls.length) return;
    setLoading(true);
    try {
      const result = await sendToBackground({ type: "DELETE_URLS", urls });
      setStatus(t("history.deleted", { count: result.deletedCount, entry: historyEntryWord(language, result.deletedCount) }));
      await runSearch();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function openUrls(urls: string[]) {
    if (!urls.length) return;
    setLoading(true);
    try {
      await Promise.all(urls.map((url) => sendToBackground({ type: "OPEN_URL", url })));
      setStatus(t("history.opened", { count: urls.length }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel results-panel">
      <div className="history-command-form">
        <div className="history-search-row">
          <label>
            <span>{t("history.keywords")}</span>
            <input value={filter.text ?? ""} onChange={(event) => setFilter((item) => ({ ...item, text: event.target.value }))} />
          </label>
          <button className="primary" onClick={runSearch} disabled={loading} type="button">
            <Search size={15} />
            {t("history.search")}
          </button>
          <button onClick={() => setFilterOpen((value) => !value)} type="button">
            {t("history.filters")}
          </button>
        </div>
        {filterOpen ? <FilterGrid t={t} filter={filter} setFilter={setFilter} includeText={false} compact /> : null}
      </div>
      <div className="toolbar compact-toolbar">
        <HistoryBulkActions
          t={t}
          records={records}
          selected={selected}
          setSelected={setSelected}
          loading={loading}
          onOpenSelected={() => openUrls(selectedUrls)}
          onDeleteSelected={() => deleteUrls(selectedUrls)}
        />
        <button
          onClick={() => deleteUrls(records.map((record) => record.url))}
          disabled={!records.length || loading}
          type="button"
        >
          <Trash2 size={16} />
          {t("history.deleteCurrentResults")}
        </button>
        <button onClick={() => setRecords([])} disabled={loading} type="button" title={t("history.clearResults")}>
          <RotateCcw size={16} />
        </button>
      </div>
      <HistoryList language={language} t={t} records={records} selected={selected} setSelected={setSelected} setStatus={setStatus} />
    </section>
  );
}

export function HistoryBulkActions({
  t,
  records,
  selected,
  setSelected,
  loading,
  onOpenSelected,
  onDeleteSelected
}: {
  t: Translator;
  records: HistoryRecord[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  loading?: boolean;
  onOpenSelected: () => void | Promise<void>;
  onDeleteSelected: () => void | Promise<void>;
}) {
  const selectedCount = selectedHistoryRecords(records, selected).length;
  const allVisibleSelected = records.length > 0 && selectedCount === records.length;

  if (!selectedCount) return null;

  return (
    <div className="history-bulk-actions" data-history-bulk-actions="true">
      <span>{t("history.selected", { count: selectedCount })}</span>
      <button onClick={() => setSelected(allVisibleSelected ? new Set() : selectAllHistory(records))} disabled={loading} type="button">
        {allVisibleSelected ? t("history.deselectAll") : t("history.selectAll")}
      </button>
      <button onClick={() => void onOpenSelected()} disabled={loading} type="button">
        <ExternalLink size={14} />
        {t("history.openSelected")}
      </button>
      <button onClick={() => void onDeleteSelected()} disabled={loading} type="button">
        <Trash2 size={14} />
        {t("history.deleteSelected")}
      </button>
    </div>
  );
}

export function useHistoryFilter() {
  const [filter, setFilter] = useState<HistoryFilter>({ text: "", domain: "", url: "", maxResults: 0 });
  return [filter, setFilter] as const;
}

export function FilterGrid({
  t,
  filter,
  setFilter,
  includeText = true,
  compact = false
}: {
  t: Translator;
  filter: HistoryFilter;
  setFilter: React.Dispatch<React.SetStateAction<HistoryFilter>>;
  includeText?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "filter-grid is-compact" : "filter-grid"}>
      {includeText ? (
        <label>
            <span>{t("history.keywords")}</span>
          <input value={filter.text ?? ""} onChange={(event) => setFilter((item) => ({ ...item, text: event.target.value }))} />
        </label>
      ) : null}
      <label>
          <span>{t("history.domain")}</span>
        <input
          value={filter.domain ?? ""}
          onChange={(event) => setFilter((item) => ({ ...item, domain: event.target.value }))}
          onBlur={(event) => setFilter((item) => ({ ...item, domain: extractHost(event.target.value) }))}
          placeholder="youtube.com"
        />
      </label>
      <label>
          <span>{t("history.urlContains")}</span>
        <input
          value={filter.url ?? ""}
          onChange={(event) => setFilter((item) => ({ ...item, url: event.target.value }))}
          onBlur={(event) => setFilter((item) => ({ ...item, url: cleanUrlPattern(event.target.value) }))}
          placeholder="www.site.com/path"
        />
      </label>
      <label>
          <span>{t("history.startTime")}</span>
        <input
          type="datetime-local"
          onChange={(event) =>
            setFilter((item) => ({
              ...item,
              startTime: event.target.value ? new Date(event.target.value).getTime() : undefined
            }))
          }
        />
      </label>
      <label>
          <span>{t("history.endTime")}</span>
        <input
          type="datetime-local"
          onChange={(event) =>
            setFilter((item) => ({
              ...item,
              endTime: event.target.value ? new Date(event.target.value).getTime() : undefined
            }))
          }
        />
      </label>
      <label>
          <span>{t("history.maxResults")}</span>
        <input
          type="number"
          min="0"
          value={filter.maxResults ?? 0}
          onChange={(event) => setFilter((item) => ({ ...item, maxResults: Number(event.target.value) }))}
        />
      </label>
    </div>
  );
}

export function HistoryList({
  records,
  selected,
  setSelected,
  language,
  t,
  setStatus
}: {
  records: HistoryRecord[];
  selected?: Set<string>;
  setSelected?: React.Dispatch<React.SetStateAction<Set<string>>>;
  language: UiLanguage;
  t: Translator;
  setStatus: (status: string) => void;
}) {
  async function openUrl(url: string) {
    try {
      await sendToBackground({ type: "OPEN_URL", url });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  if (!records.length) return <div className="empty-state">{t("history.noRecords")}</div>;

  return (
    <div className="history-list">
      {records.map((record) => {
        const checked = selected?.has(record.id) ?? false;
        return (
          <article className="history-row" key={record.id}>
            {selected && setSelected ? (
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelected((previous) => {
                    return toggleHistorySelection(pruneHistorySelection(records, previous), record.id);
                  })
                }
              />
            ) : null}
            <button className="icon-button" onClick={() => openUrl(record.url)} type="button" title={t("common.open")}>
              <ExternalLink size={15} />
            </button>
            <div className="record-main">
              <h3>{record.title || record.url}</h3>
              <p>{record.url}</p>
              <div className="meta-line">
                <span>{formatHistoryTime(language, record.lastVisitTime)}</span>
                <span>{t("history.visitCount", { count: record.visitCount, unit: record.visitCount === 1 ? "visit" : "visits" })}</span>
                <span>{t("history.typedCount", { count: record.typedCount, unit: record.typedCount === 1 ? "typed visit" : "typed visits" })}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
