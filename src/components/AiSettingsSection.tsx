import {
  AI_PRESETS,
  resolveAiConfig,
  isAiConfigValid
} from '@/lib/aiConfig'

interface AiSettingsSectionProps {
  settings: Record<string, string>
  savingKey: string | null
  updateSetting: (key: string, value: string) => Promise<void>
}

export function AiSettingsSection({
  settings,
  savingKey,
  updateSetting
}: AiSettingsSectionProps): JSX.Element {
  const providerType = settings.ai_provider_type === 'custom' ? 'custom' : 'preset'
  const resolved = resolveAiConfig(settings)
  const configValid = isAiConfigValid(resolved)

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">AI 模型</h2>
        <p className="text-sm text-gray-500 mt-1">
          支持预设方案或自定义 OpenAI 兼容接口
        </p>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">接入方式</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => updateSetting('ai_provider_type', 'preset')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              providerType === 'preset'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            预设方案
          </button>
          <button
            type="button"
            onClick={() => updateSetting('ai_provider_type', 'custom')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              providerType === 'custom'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            自定义接入
          </button>
        </div>
      </div>

      {providerType === 'preset' ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="ai-preset" className="block text-sm font-medium text-gray-700 mb-1">
              预设模型
            </label>
            <select
              id="ai-preset"
              value={settings.ai_preset || settings.ai_model || AI_PRESETS[0].id}
              onChange={e => updateSetting('ai_preset', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AI_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          {(() => {
            const preset =
              AI_PRESETS.find(
                p => p.id === (settings.ai_preset || settings.ai_model || AI_PRESETS[0].id)
              ) ?? AI_PRESETS[0]
            return (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 space-y-1">
                <p>{preset.description}</p>
                <p className="font-mono break-all">Base URL: {preset.baseUrl}</p>
                <p className="font-mono">Model: {preset.model}</p>
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="ai-base-url" className="block text-sm font-medium text-gray-700 mb-1">
              API Base URL
            </label>
            <input
              id="ai-base-url"
              type="url"
              value={settings.ai_custom_base_url || ''}
              onChange={e => updateSetting('ai_custom_base_url', e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              OpenAI 兼容接口地址，如 OpenAI、Ollama、OneAPI 等
            </p>
          </div>
          <div>
            <label htmlFor="ai-custom-model" className="block text-sm font-medium text-gray-700 mb-1">
              Model ID
            </label>
            <input
              id="ai-custom-model"
              type="text"
              value={settings.ai_custom_model || ''}
              onChange={e => updateSetting('ai_custom_model', e.target.value)}
              placeholder="deepseek-v4-flash / qwen3.6-flash / kimi-k2.6 / gpt-4o ..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
          API Key
        </label>
        <div className="relative">
          <input
            id="api-key"
            type="password"
            value={settings.api_key || ''}
            onChange={e => updateSetting('api_key', e.target.value)}
            placeholder={providerType === 'custom' ? '自定义服务的 API Key' : '输入 API Key'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {savingKey === 'api_key' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500">
              保存中...
            </span>
          )}
        </div>
      </div>

      {!configValid && providerType === 'custom' && (
        <p className="text-xs text-amber-600">
          请填写有效的 Base URL 和 Model ID 后再生成报告
        </p>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.offline_mode === 'true'}
          onChange={e => updateSetting('offline_mode', e.target.checked ? 'true' : 'false')}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">离线模式</span>
          <p className="text-xs text-gray-500">
            开启后不使用 AI 生成摘要，仅展示原始活动记录
          </p>
        </div>
      </label>
    </section>
  )
}
