import { Eye, EyeOff, Plus, Save, TestTube2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ensureApiHostPermission, reorderDefaultProvider, sendToBackground } from "../shared/client";
import { newId } from "../shared/siteRules";
import type { AiProvider, AppSettings } from "../shared/types";

interface SettingsPanelProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  setStatus: (status: string) => void;
}

export function SettingsPanel({ settings, setSettings, setStatus }: SettingsPanelProps) {
  const [selectedId, setSelectedId] = useState(settings.defaultProviderId ?? settings.aiProviders[0]?.id ?? "");
  const [showKey, setShowKey] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "neutral"; text: string } | null>(null);

  useEffect(() => {
    if (!selectedId && settings.aiProviders[0]) setSelectedId(settings.aiProviders[0].id);
  }, [selectedId, settings.aiProviders]);

  const selected = useMemo(
    () => settings.aiProviders.find((provider) => provider.id === selectedId),
    [settings.aiProviders, selectedId]
  );

  async function persist(nextSettings: AppSettings, feedbackText = "设置已保存") {
    setSettings(nextSettings);
    await sendToBackground({ type: "SAVE_SETTINGS", settings: nextSettings });
    setStatus("");
    if (feedbackText) setFeedback({ tone: "success", text: feedbackText });
  }

  async function addProvider() {
    const provider: AiProvider = {
      id: newId("provider"),
      name: "自定义 API",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-4.1-mini",
      enabled: true,
      isDefault: !settings.aiProviders.length
    };
    const nextSettings = {
      ...settings,
      defaultProviderId: settings.defaultProviderId ?? provider.id,
      aiProviders: [provider, ...settings.aiProviders]
    };
    setSelectedId(provider.id);
    await persist(nextSettings, "已添加模型服务");
  }

  async function updateProvider(patch: Partial<AiProvider>) {
    if (!selected) return;
    const nextProvider = { ...selected, ...patch };
    const nextSettings = {
      ...settings,
      aiProviders: settings.aiProviders.map((provider) => (provider.id === selected.id ? nextProvider : provider))
    };
    setSettings(nextSettings);
  }

  async function prepareSelectedSettings(): Promise<AppSettings | null> {
    if (!selected) return null;
    const nextSettings = selected.isDefault ? reorderDefaultProvider(settings, selected.id) : settings;
    const allowed = await ensureApiHostPermission(nextSettings, selected.id);
    if (!allowed) {
      setFeedback({ tone: "error", text: "没有授予该 API 域名的访问权限" });
      return null;
    }
    return nextSettings;
  }

  async function saveSelected() {
    const nextSettings = await prepareSelectedSettings();
    if (!nextSettings) return;
    await persist(nextSettings, "设置已保存");
  }

  async function testSelected() {
    if (!selected) return;
    const nextSettings = await prepareSelectedSettings();
    if (!nextSettings) return;
    await persist(nextSettings, "");
    setFeedback({ tone: "neutral", text: "正在测试连接..." });
    try {
      await sendToBackground({ type: "TEST_AI_PROVIDER", providerId: selected.id });
      setFeedback({ tone: "success", text: "连接测试通过" });
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }

  async function removeSelected() {
    if (!selected) return;
    const nextProviders = settings.aiProviders.filter((provider) => provider.id !== selected.id);
    const nextDefault = nextProviders[0]?.id;
    const nextSettings = reorderDefaultProvider({ ...settings, aiProviders: nextProviders, defaultProviderId: nextDefault }, nextDefault ?? "");
    setSelectedId(nextDefault ?? "");
    await persist(nextSettings, "已移除模型服务");
  }

  return (
    <section className="panel settings-panel">
      <div className="settings-topline">
        <label>
          <span>模型服务</span>
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">未配置</option>
            {settings.aiProviders.map((provider) => (
              <option value={provider.id} key={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={addProvider} type="button">
          <Plus size={16} />
          添加模型服务
        </button>
      </div>

      {selected ? (
        <div className="compact-form settings-form">
          <label>
            <span>服务名称</span>
            <input value={selected.name} onChange={(event) => updateProvider({ name: event.target.value })} />
          </label>
          <label>
            <span>API Base URL</span>
            <input value={selected.baseUrl} onChange={(event) => updateProvider({ baseUrl: event.target.value })} />
          </label>
          <label>
            <span>API Key</span>
            <div className="secret-row">
              <input
                type={showKey ? "text" : "password"}
                value={selected.apiKey}
                onChange={(event) => updateProvider({ apiKey: event.target.value })}
              />
              <button onClick={() => setShowKey((value) => !value)} type="button" title={showKey ? "隐藏" : "显示"}>
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>
          <label>
            <span>模型</span>
            <input
              list="model-presets"
              value={selected.model}
              onChange={(event) => updateProvider({ model: event.target.value })}
              placeholder="例如 mimo-v2.5-pro"
            />
            <datalist id="model-presets">
              <option value="gpt-4.1-mini" />
              <option value="gpt-4.1" />
              <option value="gpt-5.1-mini" />
              <option value="mimo-v2.5-pro" />
            </datalist>
          </label>
          <div className="check-row">
            <label>
              <input
                type="checkbox"
                checked={selected.isDefault}
                onChange={(event) => {
                  const next = event.target.checked ? reorderDefaultProvider(settings, selected.id) : settings;
                  setSettings(next);
                }}
              />
              默认使用
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.includeQueryStringsInAi}
                onChange={(event) => setSettings({ ...settings, includeQueryStringsInAi: event.target.checked })}
              />
              发送完整 URL
            </label>
          </div>
          <div className="toolbar">
            <button className="primary" onClick={saveSelected} type="button">
              <Save size={16} />
              保存
            </button>
            <button onClick={testSelected} type="button">
              <TestTube2 size={16} />
              测试
            </button>
            <button onClick={removeSelected} type="button">
              <Trash2 size={16} />
            </button>
            {feedback ? (
              <span className={`connection-indicator is-${feedback.tone}`}>
                <span />
                {feedback.text}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="empty-state">还没有配置模型服务</div>
      )}
    </section>
  );
}
