import { useState, useCallback } from 'react'

interface PrivacySettingsProps {
  settings: Record<string, string>
  updateSetting: (key: string, value: string) => Promise<void>
}

function parseJsonArray(raw: string | undefined): string[] {
  try {
    const arr = JSON.parse(raw ?? '[]') as unknown
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}

export function PrivacySettings({
  settings,
  updateSetting
}: PrivacySettingsProps): JSX.Element {
  const keywords = parseJsonArray(settings.exclude_title_keywords)
  const [keywordInput, setKeywordInput] = useState('')
  const [rulesText, setRulesText] = useState(
    () => settings.sanitization_rules ?? '[]'
  )
  const [rulesError, setRulesError] = useState<string | null>(null)

  const saveKeywords = useCallback(
    async (list: string[]) => {
      await updateSetting('exclude_title_keywords', JSON.stringify(list))
    },
    [updateSetting]
  )

  const addKeyword = async (): Promise<void> => {
    const word = keywordInput.trim()
    if (!word || keywords.includes(word)) return
    setKeywordInput('')
    await saveKeywords([...keywords, word])
  }

  const removeKeyword = async (word: string): Promise<void> => {
    await saveKeywords(keywords.filter(k => k !== word))
  }

  const saveRules = async (): Promise<void> => {
    try {
      const parsed = JSON.parse(rulesText)
      if (!Array.isArray(parsed)) throw new Error('必须是 JSON 数组')
      setRulesError(null)
      await updateSetting('sanitization_rules', JSON.stringify(parsed))
    } catch {
      setRulesError('JSON 格式无效，请使用 [{ "pattern": "...", "replacement": "..." }] 格式')
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">隐私</h2>
        <p className="text-sm text-gray-500 mt-1">
          采集前排除敏感标题、存储时脱敏；AI 仅接收结构化摘要，不上传原始窗口标题
        </p>
      </div>

      <div>
        <label htmlFor="exclude-keywords" className="block text-sm font-medium text-gray-700 mb-1">
          排除窗口标题关键词
        </label>
        <p className="text-xs text-gray-400 mb-2">标题包含以下词的活动将不被记录</p>
        <div className="flex gap-2">
          <input
            id="exclude-keywords"
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void addKeyword()
            }}
            placeholder="例如：网银、工资、绩效"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => void addKeyword()}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            添加
          </button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {keywords.map(word => (
              <span
                key={word}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-700"
              >
                {word}
                <button
                  type="button"
                  onClick={() => void removeKeyword(word)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={`移除 ${word}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="sanitization-rules" className="block text-sm font-medium text-gray-700 mb-1">
          脱敏规则（JSON）
        </label>
        <p className="text-xs text-gray-400 mb-2">
          存储时应用的正则替换，例如 pattern / replacement 对象数组
        </p>
        <textarea
          id="sanitization-rules"
          value={rulesText}
          onChange={e => setRulesText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {rulesError && <p className="text-xs text-red-600 mt-1">{rulesError}</p>}
        <button
          type="button"
          onClick={() => void saveRules()}
          className="mt-2 px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800"
        >
          保存脱敏规则
        </button>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.git_integration_enabled !== 'false'}
          onChange={e =>
            updateSetting('git_integration_enabled', e.target.checked ? 'true' : 'false')
          }
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">Git 集成</span>
          <p className="text-xs text-gray-500">
            报告生成时查询 Git 提交记录（不上传仓库路径）
          </p>
        </div>
      </label>
    </section>
  )
}
