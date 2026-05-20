import { ExternalLink, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { sendToBackground } from "../shared/client";
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
  setStatus: (status: string) => void;
}

export function HistoryPanel({ setStatus }: HistoryPanelProps) {
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
      setStatus(`Found ${nextRecords.length} history record(s)`);
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
      setStatus(`Deleted ${result.deletedCount} URL history entr${result.deletedCount === 1 ? "y" : "ies"}`);
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
      setStatus(`Opened ${urls.length} history record(s)`);
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
            <span>Keywords</span>
            <input value={filter.text ?? ""} onChange={(event) => setFilter((item) => ({ ...item, text: event.target.value }))} />
          </label>
          <button className="primary" onClick={runSearch} disabled={loading} type="button">
            <Search size={15} />
            Search
          </button>
          <button onClick={() => setFilterOpen((value) => !value)} type="button">
            Filters
          </button>
        </div>
        {filterOpen ? <FilterGrid filter={filter} setFilter={setFilter} includeText={false} compact /> : null}
      </div>
      <div className="toolbar compact-toolbar">
        <HistoryBulkActions
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
          Delete current results
        </button>
        <button onClick={() => setRecords([])} disabled={loading} type="button" title="Clear results">
          <RotateCcw size={16} />
        </button>
      </div>
      <HistoryList records={records} selected={selected} setSelected={setSelected} setStatus={setStatus} />
    </section>
  );
}

export function HistoryBulkActions({
  records,
  selected,
  setSelected,
  loading,
  onOpenSelected,
  onDeleteSelected
}: {
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
      <span>{selectedCount} selected</span>
      <button onClick={() => setSelected(allVisibleSelected ? new Set() : selectAllHistory(records))} disabled={loading} type="button">
        {allVisibleSelected ? "Deselect all" : "Select all"}
      </button>
      <button onClick={() => void onOpenSelected()} disabled={loading} type="button">
        <ExternalLink size={14} />
        Open selected
      </button>
      <button onClick={() => void onDeleteSelected()} disabled={loading} type="button">
        <Trash2 size={14} />
        Delete selected
      </button>
    </div>
  );
}

export function useHistoryFilter() {
  const [filter, setFilter] = useState<HistoryFilter>({ text: "", domain: "", url: "", maxResults: 0 });
  return [filter, setFilter] as const;
}

export function FilterGrid({
  filter,
  setFilter,
  includeText = true,
  compact = false
}: {
  filter: HistoryFilter;
  setFilter: React.Dispatch<React.SetStateAction<HistoryFilter>>;
  includeText?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "filter-grid is-compact" : "filter-grid"}>
      {includeText ? (
        <label>
            <span>Keywords</span>
          <input value={filter.text ?? ""} onChange={(event) => setFilter((item) => ({ ...item, text: event.target.value }))} />
        </label>
      ) : null}
      <label>
          <span>Domain</span>
        <input
          value={filter.domain ?? ""}
          onChange={(event) => setFilter((item) => ({ ...item, domain: event.target.value }))}
          onBlur={(event) => setFilter((item) => ({ ...item, domain: extractHost(event.target.value) }))}
          placeholder="youtube.com"
        />
      </label>
      <label>
          <span>URL contains</span>
        <input
          value={filter.url ?? ""}
          onChange={(event) => setFilter((item) => ({ ...item, url: event.target.value }))}
          onBlur={(event) => setFilter((item) => ({ ...item, url: cleanUrlPattern(event.target.value) }))}
          placeholder="www.site.com/path"
        />
      </label>
      <label>
          <span>Start time</span>
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
          <span>End time</span>
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
          <span>Max results</span>
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
  setStatus
}: {
  records: HistoryRecord[];
  selected?: Set<string>;
  setSelected?: React.Dispatch<React.SetStateAction<Set<string>>>;
  setStatus: (status: string) => void;
}) {
  async function openUrl(url: string) {
    try {
      await sendToBackground({ type: "OPEN_URL", url });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  if (!records.length) return <div className="empty-state">No history records</div>;

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
            <button className="icon-button" onClick={() => openUrl(record.url)} type="button" title="Open">
              <ExternalLink size={15} />
            </button>
            <div className="record-main">
              <h3>{record.title || record.url}</h3>
              <p>{record.url}</p>
              <div className="meta-line">
                <span>{formatTime(record.lastVisitTime)}</span>
                <span>{record.visitCount} visit{record.visitCount === 1 ? "" : "s"}</span>
                <span>{record.typedCount} typed visit{record.typedCount === 1 ? "" : "s"}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatTime(time: number) {
  if (!time) return "Unknown time";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(time);
}
