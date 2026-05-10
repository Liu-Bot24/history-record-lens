import { Brain, History, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AiPanel } from "./components/AiPanel";
import { HomePanel } from "./components/HomePanel";
import { AUTHOR_LINK, AUTHOR_TEXT } from "./shared/branding";
import { sendToBackground } from "./shared/client";
import type { AppSettings, CleanupLogEntry, SiteRule } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";

type AppTab = "ai" | "cleanup";

const tabs = [
  { id: "ai", label: "AI 查询历史记录", icon: Brain },
  { id: "cleanup", label: "一键清理浏览记录", icon: ShieldCheck }
] satisfies Array<{ id: AppTab; label: string; icon: typeof History }>;

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("ai");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [rules, setRules] = useState<SiteRule[]>([]);
  const [logs, setLogs] = useState<CleanupLogEntry[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    Promise.all([
      sendToBackground({ type: "GET_SETTINGS" }),
      sendToBackground({ type: "GET_SITE_RULES" }),
      sendToBackground({ type: "GET_CLEANUP_LOG" })
    ])
      .then(([nextSettings, nextRules, nextLogs]) => {
        setSettings(nextSettings);
        setRules(nextRules);
        setLogs(nextLogs);
      })
      .catch((error: Error) => setStatus(error.message));
  }, []);

  const quickRules = useMemo(() => rules.filter((rule) => rule.enabled && rule.quickAccess), [rules]);
  const cleanupRules = useMemo(() => rules.filter((rule) => rule.enabled && rule.cleanupEnabled), [rules]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="title-line">
            <h1>历史记录透镜</h1>
            <a className="author-link" href={AUTHOR_LINK} rel="noreferrer" target="_blank">
              {AUTHOR_TEXT}
            </a>
          </div>
          <p>
            {activeTab === "cleanup" && rules.length
              ? `${quickRules.length} 个快捷入口，${cleanupRules.length} 个清理规则`
              : activeTab === "cleanup"
                ? "快捷访问和清理清单"
                : "用大模型查找和管理浏览历史"}
          </p>
        </div>
      </header>

      <nav className="tabs" aria-label="Primary">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "tab is-active" : "tab"}
              onClick={() => {
                setActiveTab(tab.id);
                setStatus("");
              }}
              type="button"
              title={tab.label}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {status ? <div className="status-line">{status}</div> : null}

      <main>
        {activeTab === "ai" ? (
          <AiPanel settings={settings} setSettings={setSettings} setStatus={setStatus} />
        ) : null}
        {activeTab === "cleanup" ? (
          <HomePanel
            rules={rules}
            setRules={setRules}
            logs={logs}
            setLogs={setLogs}
            settings={settings}
            setSettings={setSettings}
            setStatus={setStatus}
          />
        ) : null}
      </main>
    </div>
  );
}
