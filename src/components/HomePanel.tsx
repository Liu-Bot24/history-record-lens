import { Check, ChevronDown, ChevronUp, Edit3, Eraser, ListPlus, ShieldCheck, Star, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cleanupTimeRangeLabel, cleanupTimeRangeOptions } from "../shared/cleanupTimeRange";
import { getFaviconUrl, sendToBackground } from "../shared/client";
import { createPattern, createSiteRule, parseSiteListImport } from "../shared/siteRules";
import { DEFAULT_SETTINGS } from "../shared/types";
import type { AppSettings, CleanupLogEntry, CleanupTimeRange, SiteRule } from "../shared/types";
import { labelFromUrl, normalizeComparableUrl } from "../shared/url";

interface HomePanelProps {
  rules: SiteRule[];
  setRules: (rules: SiteRule[]) => void;
  logs: CleanupLogEntry[];
  setLogs: (logs: CleanupLogEntry[]) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  setStatus: (status: string) => void;
}

export function HomePanel({ rules, setRules, logs, setLogs, settings, setSettings, setStatus }: HomePanelProps) {
  const [listText, setListText] = useState("");
  const [editingList, setEditingList] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    quick: true,
    list: true,
    time: false
  });
  const [listMode, setListMode] = useState<"view" | "edit">("view");

  const quickRules = useMemo(() => rules.filter((rule) => rule.enabled && rule.quickAccess), [rules]);
  const cleanupRules = useMemo(() => rules.filter((rule) => rule.enabled && rule.cleanupEnabled), [rules]);
  const cleanupTimeRange = settings.cleanupTimeRange ?? DEFAULT_SETTINGS.cleanupTimeRange;
  const autoCleanupEnabled = cleanupRules.length > 0 && cleanupRules.every((rule) => rule.cleanupOnTabClose);

  useEffect(() => {
    if (!editingList) setListText(rulesToListText(rules));
  }, [rules, editingList]);

  async function persist(nextRules: SiteRule[], message?: string) {
    setRules(nextRules);
    await sendToBackground({ type: "SAVE_SITE_RULES", rules: nextRules });
    if (message) setStatus(message);
  }

  async function persistSettings(nextSettings: AppSettings, message?: string) {
    setSettings(nextSettings);
    await sendToBackground({ type: "SAVE_SETTINGS", settings: nextSettings });
    if (message) setStatus(message);
  }

  async function saveTextList(text = listText) {
    const parsedRules = mergeParsedRules(parseSiteListImport(text), rules);
    await persist(parsedRules, `清单已保存，当前 ${parsedRules.length} 个网站`);
    setListText(rulesToListText(parsedRules));
    setEditingList(false);
  }

  async function addCurrentSite() {
    try {
      const tab = await sendToBackground({ type: "GET_ACTIVE_TAB" });
      const activeUrl = new URL(tab.url);
      const homeUrl = `${activeUrl.origin}/`;
      const rule = createSiteRule({
        name: labelFromUrl(homeUrl),
        homeUrl,
        patterns: [createPattern("domain", homeUrl)],
        quickAccess: false,
        cleanupEnabled: true,
        cleanupOnTabClose: false
      });
      const nextRules = mergeParsedRules([rule, ...rules], rules);
      await persist(nextRules, "已添加当前网站");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function updateRule(rule: SiteRule, message?: string) {
    await persist(rules.map((item) => (item.id === rule.id ? { ...rule, updatedAt: Date.now() } : item)), message);
  }

  async function updateCleanupTimeRange(range: CleanupTimeRange) {
    await persistSettings({ ...settings, cleanupTimeRange: range }, `清理时间范围：${cleanupTimeRangeLabel(range)}`);
  }

  async function toggleAutoCleanupForCleanupRules() {
    if (!cleanupRules.length) return;
    const nextValue = !autoCleanupEnabled;
    await persist(
      rules.map((rule) =>
        rule.cleanupEnabled || rule.cleanupOnTabClose
          ? { ...rule, cleanupOnTabClose: rule.cleanupEnabled ? nextValue : false, updatedAt: Date.now() }
          : rule
      ),
      nextValue ? "已启用自动清理" : "已停用自动清理"
    );
  }

  async function removeRule(ruleId: string) {
    await persist(rules.filter((rule) => rule.id !== ruleId), "已从清单移除");
  }

  async function openRule(rule: SiteRule) {
    await sendToBackground({ type: "OPEN_URL", url: rule.homeUrl });
  }

  async function cleanRule(rule: SiteRule) {
    setBusyRuleId(rule.id);
    try {
      const result = await sendToBackground({ type: "CLEAN_SITE_RULE", ruleId: rule.id });
      setStatus(`已清理 ${result.deletedCount} 条 URL 历史`);
      setLogs(await sendToBackground({ type: "GET_CLEANUP_LOG" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyRuleId(null);
    }
  }

  async function cleanAllEnabled() {
    if (!cleanupRules.length) {
      setStatus("还没有加入清理列表的网站");
      return;
    }
    let deletedCount = 0;
    setBusyRuleId("all");
    try {
      for (const rule of cleanupRules) {
        const result = await sendToBackground({ type: "CLEAN_SITE_RULE", ruleId: rule.id });
        deletedCount += result.deletedCount;
      }
      setStatus(`已清理 ${cleanupRules.length} 个网站，共 ${deletedCount} 条 URL 历史`);
      setLogs(await sendToBackground({ type: "GET_CLEANUP_LOG" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyRuleId(null);
    }
  }

  return (
    <section className={`home-panel dense ${listMode === "edit" ? "is-editing-list" : ""} ${openSections.time ? "is-time-open" : "is-time-closed"}`}>
      <section className="command-bar">
        <button className="primary" onClick={cleanAllEnabled} disabled={!cleanupRules.length || busyRuleId === "all"} type="button">
          <ShieldCheck size={16} />
          一键清理
        </button>
        <button onClick={addCurrentSite} type="button">
          <ListPlus size={16} />
          添加当前网站
        </button>
        <label
          className={autoCleanupEnabled ? "switch-control with-tooltip is-on" : "switch-control with-tooltip"}
          data-tooltip="退出网站自动清理浏览记录"
          aria-label="退出网站自动清理浏览记录"
        >
          <span>自动清理</span>
          <input
            checked={autoCleanupEnabled}
            disabled={!cleanupRules.length}
            onChange={() => void toggleAutoCleanupForCleanupRules()}
            type="checkbox"
          />
          <span className="switch-track" aria-hidden="true">
            <span />
          </span>
        </label>
      </section>

      <FoldSection
        title="快捷访问"
        open={openSections.quick}
        onToggle={() => setOpenSections((value) => ({ ...value, quick: !value.quick }))}
      >
        {quickRules.length ? (
          <div className="quick-tile-grid">
            {quickRules.map((rule) => (
              <button className="quick-tile" key={rule.id} onClick={() => openRule(rule)} type="button" title={rule.name}>
                <SiteIcon rule={rule} />
                <span>{rule.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-line">勾选星标的网站会出现在这里。</div>
        )}
      </FoldSection>

      <FoldSection
        className="site-rules-section"
        title="网站清单"
        open={openSections.list}
        onToggle={() => setOpenSections((value) => ({ ...value, list: !value.list }))}
        action={
          <button
            className={listMode === "edit" ? "section-action with-tooltip is-on" : "section-action with-tooltip"}
            title={listMode === "edit" ? "完成编辑" : "编辑清单"}
            data-tooltip={listMode === "edit" ? "保存清单" : "编辑清单"}
            aria-label={listMode === "edit" ? "完成编辑" : "编辑清单"}
            onClick={async (event) => {
              event.stopPropagation();
              setOpenSections((value) => ({ ...value, list: true }));
              if (listMode === "edit") {
                await saveTextList();
                setListMode("view");
                return;
              }
              setListText(rulesToListText(rules));
              setEditingList(true);
              setListMode("edit");
            }}
            type="button"
          >
            {listMode === "edit" ? <Check size={15} /> : <Edit3 size={14} />}
          </button>
        }
      >
        {listMode === "edit" ? (
          <div className="list-editor">
            <p>格式：名称, 快捷访问 URL, 清理域名1, 清理域名2。每行一个网站。</p>
            <textarea
              autoFocus
              value={listText}
              onFocus={() => setEditingList(true)}
              onChange={(event) => {
                setEditingList(true);
                setListText(event.target.value);
              }}
              placeholder="YouTube, https://www.youtube.com, youtube.com, youtu.be"
            />
          </div>
        ) : rules.length ? (
          <div className="history-like-list">
            {rules.map((rule) => (
              <article className="history-like-row" key={rule.id}>
                <button className="history-like-link" onClick={() => openRule(rule)} title="打开网站" type="button">
                  <SiteIcon rule={rule} />
                  <span className="history-like-main">
                    <span className="row-title">{rule.name}</span>
                    <span className="row-domain">{rule.patterns.map((pattern) => pattern.value).join(", ")}</span>
                  </span>
                </button>
                <button
                  className={rule.quickAccess ? "row-toggle with-tooltip is-on" : "row-toggle with-tooltip"}
                  title={rule.quickAccess ? "已显示在快捷访问" : "显示在快捷访问"}
                  data-tooltip={rule.quickAccess ? "取消快捷访问" : "加入快捷访问"}
                  aria-label={rule.quickAccess ? "已显示在快捷访问" : "显示在快捷访问"}
                  onClick={() => updateRule({ ...rule, quickAccess: !rule.quickAccess })}
                  type="button"
                >
                  <Star size={13} />
                </button>
                <button
                  className={rule.cleanupEnabled ? "row-toggle with-tooltip is-on" : "row-toggle with-tooltip"}
                  title={rule.cleanupEnabled ? "已加入一键清理" : "加入一键清理"}
                  data-tooltip={rule.cleanupEnabled ? "取消一键清理" : "加入一键清理"}
                  aria-label={rule.cleanupEnabled ? "已加入一键清理" : "加入一键清理"}
                  onClick={() =>
                    updateRule({
                      ...rule,
                      cleanupEnabled: !rule.cleanupEnabled,
                      cleanupOnTabClose: rule.cleanupEnabled ? false : rule.cleanupOnTabClose
                    })
                  }
                  type="button"
                >
                  <ShieldCheck size={13} />
                </button>
                <button
                  className="row-icon-button with-tooltip"
                  title="立即清理历史"
                  data-tooltip="立即清理"
                  onClick={() => cleanRule(rule)}
                  disabled={busyRuleId === rule.id}
                  type="button"
                >
                  <Eraser size={14} />
                </button>
                <button className="row-icon-button with-tooltip" title="删除" data-tooltip="删除" onClick={() => removeRule(rule.id)} type="button">
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-line">还没有网站。可以写清单，也可以添加当前网站。</div>
        )}
      </FoldSection>

      <FoldSection
        className="time-range-section"
        title="清理时间范围"
        meta={cleanupTimeRangeLabel(cleanupTimeRange)}
        open={openSections.time}
        onToggle={() => setOpenSections((value) => ({ ...value, time: !value.time }))}
      >
        <div className="time-range-panel">
          <div className="range-options" role="group" aria-label="清理时间范围">
            {cleanupTimeRangeOptions.map((option) => (
              <button
                className={cleanupTimeRange.mode === option.mode ? "range-option is-active" : "range-option"}
                key={option.mode}
                onClick={() => updateCleanupTimeRange({ ...cleanupTimeRange, mode: option.mode })}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          {cleanupTimeRange.mode === "custom" ? (
            <div className="date-range-row">
              <label>
                <span>开始日期</span>
                <input
                  type="date"
                  value={cleanupTimeRange.startDate ?? ""}
                  onChange={(event) => updateCleanupTimeRange({ ...cleanupTimeRange, startDate: event.target.value })}
                />
              </label>
              <label>
                <span>结束日期</span>
                <input
                  type="date"
                  value={cleanupTimeRange.endDate ?? ""}
                  onChange={(event) => updateCleanupTimeRange({ ...cleanupTimeRange, endDate: event.target.value })}
                />
              </label>
            </div>
          ) : null}
        </div>
      </FoldSection>

    </section>
  );
}

function FoldSection({
  className,
  title,
  meta,
  open,
  onToggle,
  action,
  right,
  children
}: {
  className?: string;
  title: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={className ? `fold-section ${className}` : "fold-section"}>
      <div className="fold-title">
        <span>{title}</span>
        {action}
        {right ? <div className="fold-right">{right}</div> : null}
        {meta ? <small>{meta}</small> : null}
        <button className="fold-toggle" onClick={onToggle} type="button" title={open ? "收起" : "展开"}>
          {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>
      {open ? <div className="fold-content">{children}</div> : null}
    </section>
  );
}

function SiteIcon({ rule }: { rule: SiteRule }) {
  const faviconUrl = getFaviconUrl(rule.homeUrl, 32);
  if (!faviconUrl) return <span className="favicon-fallback">{rule.name.slice(0, 1).toUpperCase()}</span>;
  return <img className="favicon" src={faviconUrl} alt="" />;
}

function rulesToListText(rules: SiteRule[]): string {
  return rules
    .map((rule) => [rule.name, rule.homeUrl, ...rule.patterns.map((pattern) => pattern.value)].filter(Boolean).join(", "))
    .join("\n");
}

function mergeParsedRules(parsedRules: SiteRule[], previousRules: SiteRule[]): SiteRule[] {
  const previousByUrl = new Map(previousRules.map((rule) => [normalizeComparableUrl(rule.homeUrl), rule]));
  const previousByName = new Map(previousRules.map((rule) => [rule.name.trim().toLowerCase(), rule]));
  const seen = new Set<string>();

  return parsedRules.flatMap((rule) => {
    const key = normalizeComparableUrl(rule.homeUrl);
    if (seen.has(key)) return [];
    seen.add(key);

    const previous = previousByUrl.get(normalizeComparableUrl(rule.homeUrl)) ?? previousByName.get(rule.name.trim().toLowerCase());
    if (!previous) return rule;

    return {
      ...rule,
      id: previous.id,
      quickAccess: previous.quickAccess,
      cleanupEnabled: previous.cleanupEnabled,
      cleanupOnTabClose: previous.cleanupOnTabClose,
      confirmBeforeCleanup: previous.confirmBeforeCleanup,
      createdAt: previous.createdAt,
      updatedAt: Date.now()
    };
  });
}
