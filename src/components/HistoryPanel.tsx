import { ExternalLink, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { sendToBackground } from "../shared/client";
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

  const selectedUrls = useMemo(
    () => records.filter((record) => selected.has(record.id)).map((record) => record.url),
    [records, selected]
  );

  async function runSearch() {
    setLoading(true);
    setStatus("");
    try {
      const nextRecords = await sendToBackground({ type: "SEARCH_HISTORY", filter });
      setRecords(nextRecords);
      setSelected(new Set());
      setStatus(`找到 ${nextRecords.length} 条历史记录`);
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
      setStatus(`已删除 ${result.deletedCount} 条 URL 历史`);
      await runSearch();
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
            <span>关键词</span>
            <input value={filter.text ?? ""} onChange={(event) => setFilter((item) => ({ ...item, text: event.target.value }))} />
          </label>
          <button className="primary" onClick={runSearch} disabled={loading} type="button">
            <Search size={15} />
            查询
          </button>
          <button onClick={() => setFilterOpen((value) => !value)} type="button">
            筛选
          </button>
        </div>
        {filterOpen ? <FilterGrid filter={filter} setFilter={setFilter} includeText={false} compact /> : null}
      </div>
      <div className="toolbar compact-toolbar">
        <button onClick={() => deleteUrls(selectedUrls)} disabled={!selectedUrls.length || loading} type="button">
          <Trash2 size={16} />
          删除已选
        </button>
        <button
          onClick={() => deleteUrls(records.map((record) => record.url))}
          disabled={!records.length || loading}
          type="button"
        >
          <Trash2 size={16} />
          删除当前结果
        </button>
        <button onClick={() => setRecords([])} disabled={loading} type="button" title="清空结果">
          <RotateCcw size={16} />
        </button>
      </div>
      <HistoryList records={records} selected={selected} setSelected={setSelected} setStatus={setStatus} />
    </section>
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
            <span>关键词</span>
          <input value={filter.text ?? ""} onChange={(event) => setFilter((item) => ({ ...item, text: event.target.value }))} />
        </label>
      ) : null}
      <label>
          <span>域名</span>
        <input
          value={filter.domain ?? ""}
          onChange={(event) => setFilter((item) => ({ ...item, domain: event.target.value }))}
          onBlur={(event) => setFilter((item) => ({ ...item, domain: extractHost(event.target.value) }))}
          placeholder="youtube.com"
        />
      </label>
      <label>
          <span>URL 包含</span>
        <input
          value={filter.url ?? ""}
          onChange={(event) => setFilter((item) => ({ ...item, url: event.target.value }))}
          onBlur={(event) => setFilter((item) => ({ ...item, url: cleanUrlPattern(event.target.value) }))}
          placeholder="www.site.com/path"
        />
      </label>
      <label>
          <span>开始时间</span>
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
          <span>结束时间</span>
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
          <span>最多条数</span>
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

  if (!records.length) return <div className="empty-state">暂无历史记录</div>;

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
                    const next = new Set(previous);
                    if (next.has(record.id)) next.delete(record.id);
                    else next.add(record.id);
                    return next;
                  })
                }
              />
            ) : null}
            <button className="icon-button" onClick={() => openUrl(record.url)} type="button" title="打开">
              <ExternalLink size={15} />
            </button>
            <div className="record-main">
              <h3>{record.title || record.url}</h3>
              <p>{record.url}</p>
              <div className="meta-line">
                <span>{formatTime(record.lastVisitTime)}</span>
                <span>{record.visitCount} 次访问</span>
                <span>{record.typedCount} 次输入</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatTime(time: number) {
  if (!time) return "未知时间";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(time);
}
