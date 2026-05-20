import { Brain, History, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AiPanel } from "./components/AiPanel";
import { HomePanel } from "./components/HomePanel";
import { AUTHOR_LINK, AUTHOR_TEXT } from "./shared/branding";
import { sendToBackground } from "./shared/client";
import { createTranslator } from "./shared/i18n";
import type { UiLanguage } from "./shared/localPreferences";
import { loadLanguagePreference, saveLanguagePreference } from "./shared/localPreferences";
import type { AppSettings, CleanupLogEntry, SiteRule } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";

type AppTab = "ai" | "cleanup";

const tabs = [
  { id: "ai", labelKey: "tabs.ai", icon: Brain },
  { id: "cleanup", labelKey: "tabs.cleanup", icon: ShieldCheck }
] satisfies Array<{ id: AppTab; labelKey: "tabs.ai" | "tabs.cleanup"; icon: typeof History }>;

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("ai");
  const [language, setLanguage] = useState<UiLanguage>(() => loadLanguagePreference());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [rules, setRules] = useState<SiteRule[]>([]);
  const [logs, setLogs] = useState<CleanupLogEntry[]>([]);
  const [status, setStatus] = useState("");
  const t = useMemo(() => createTranslator(language), [language]);

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

  useEffect(() => {
    document.title = t("app.title");
  }, [t]);

  const quickRules = useMemo(() => rules.filter((rule) => rule.enabled && rule.quickAccess), [rules]);
  const cleanupRules = useMemo(() => rules.filter((rule) => rule.enabled && rule.cleanupEnabled), [rules]);

  function updateLanguage(nextLanguage: UiLanguage) {
    setLanguage(nextLanguage);
    saveLanguagePreference(nextLanguage);
    setStatus("");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="title-line">
            <h1>{t("app.title")}</h1>
            <a className="author-link" href={AUTHOR_LINK} rel="noreferrer" target="_blank">
              {AUTHOR_TEXT}
            </a>
          </div>
          <p>
            {activeTab === "cleanup" && rules.length
              ? t("app.subtitle.cleanupCounts", { quick: quickRules.length, cleanup: cleanupRules.length })
              : activeTab === "cleanup"
                ? t("app.subtitle.cleanupEmpty")
                : t("app.subtitle.ai")}
          </p>
        </div>
        <LanguageToggle language={language} onChange={updateLanguage} t={t} />
      </header>

      <nav className="tabs" aria-label="Primary">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const label = t(tab.labelKey);
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "tab is-active" : "tab"}
              onClick={() => {
                setActiveTab(tab.id);
                setStatus("");
              }}
              type="button"
              title={label}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {status ? <div className="status-line">{status}</div> : null}

      <main>
        {activeTab === "ai" ? (
          <AiPanel language={language} t={t} settings={settings} setSettings={setSettings} setStatus={setStatus} />
        ) : null}
        {activeTab === "cleanup" ? (
          <HomePanel
            language={language}
            t={t}
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

function LanguageToggle({
  language,
  onChange,
  t
}: {
  language: UiLanguage;
  onChange: (language: UiLanguage) => void;
  t: ReturnType<typeof createTranslator>;
}) {
  return (
    <div className="language-toggle" role="group" aria-label={t("language.label")}>
      {(["zh", "en"] as const).map((item) => (
        <button
          key={item}
          className={language === item ? "is-active" : ""}
          onClick={() => onChange(item)}
          type="button"
          aria-pressed={language === item}
        >
          {item === "zh" ? t("language.zh") : t("language.en")}
        </button>
      ))}
    </div>
  );
}
