import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react'

const CATEGORY_ORDER: string[] = [
  'code_editor', 'terminal', 'browser', 'design', 'docs',
  'communication', 'meeting', 'file_manager', 'other'
]



interface CategorySettingsProps {
  settings: Record<string, string>
  updateSetting: (key: string, value: string) => Promise<void>
}

type CategoryMapping = Record<string, string[]>

function parseMapping(raw: string | undefined): CategoryMapping {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) return {}
    const result: CategoryMapping = {}
    for (const [cat, procs] of Object.entries(parsed)) {
      if (Array.isArray(procs)) {
        result[cat] = procs.map(String)
      }
    }
    return result
  } catch {
    return {}
  }
}

export function CategorySettings({
  settings,
  updateSetting
}: CategorySettingsProps): JSX.Element {
  const { t } = useTranslation()
  const categoryLabel = useCallback((cat: string) => t(`category.${cat}`), [t])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [newProc, setNewProc] = useState('')
  const [newCat, setNewCat] = useState('code_editor')
  const [defaultMapping, setDefaultMapping] = useState<CategoryMapping | null>(null)
  const [loading, setLoading] = useState(true)

  // 当前完整映射：默认 + 用户覆盖
  const mapping = useMemo<CategoryMapping>(() => {
    const saved = parseMapping(settings.process_categories)
    if (!defaultMapping) return saved
    // 合并：默认中有的分类保留，用户覆盖的分类替换
    const merged: CategoryMapping = {}
    for (const cat of CATEGORY_ORDER) {
      const defaults = defaultMapping[cat] ?? []
      const savedProcs = saved[cat]
      merged[cat] = savedProcs ?? defaults
    }
    // 用户添加的但不在 CATEGORY_ORDER 中的分类也包含进来
    for (const [cat, procs] of Object.entries(saved)) {
      if (!merged[cat]) merged[cat] = procs
    }
    return merged
  }, [settings.process_categories, defaultMapping])

  // 加载默认映射
  useEffect(() => {
    window.electronAPI.getDefaultProcessCategories().then((data) => {
      setDefaultMapping(data.mapping)
    }).finally(() => setLoading(false))
  }, [])

  const toggleExpand = (cat: string): void => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const saveMapping = useCallback(
    async (next: CategoryMapping) => {
      await updateSetting('process_categories', JSON.stringify(next))
    },
    [updateSetting]
  )

  const addProcess = async (): Promise<void> => {
    const proc = newProc.trim().toLowerCase()
    if (!proc) return
    setNewProc('')

    const current = mapping[newCat] ?? []
    if (current.includes(proc)) return

    const next = { ...mapping, [newCat]: [...current, proc] }
    await saveMapping(next)
  }

  const removeProcess = async (cat: string, proc: string): Promise<void> => {
    const current = mapping[cat] ?? []
    const next = { ...mapping, [cat]: current.filter(p => p !== proc) }
    await saveMapping(next)
  }

  if (loading) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{t('categorySettings.title')}</h2>
        <p className="text-sm text-gray-400">{t('common.loadingShort')}</p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('categorySettings.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('categorySettings.subtitle')}</p>
      </div>

      {/* 添加进程 */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={newProc}
          onChange={e => setNewProc(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void addProcess() }}
          placeholder={t('categorySettings.addPlaceholder')}
          className="flex-1 min-w-[160px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CATEGORY_ORDER.map(cat => (
            <option key={cat} value={cat}>{categoryLabel(cat)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void addProcess()}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </button>
      </div>

      {/* 分类列表 */}
      <div className="space-y-1">
        {CATEGORY_ORDER.map(cat => {
          const procs = mapping[cat] ?? []
          const isExpanded = expanded[cat] !== false // 默认展开
          return (
            <div key={cat} className="border border-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => toggleExpand(cat)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-800">
                  {categoryLabel(cat)}
                </span>
                <span className="text-xs text-gray-400">
                  {t('categorySettings.processCount', { count: procs.length })}
                </span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5">
                  {procs.length === 0 && (
                    <p className="text-xs text-gray-400 px-1">{t('categorySettings.noProcesses')}</p>
                  )}
                  {procs.map(proc => (
                    <span
                      key={proc}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700"
                    >
                      {proc}
                      <button
                        type="button"
                        onClick={() => void removeProcess(cat, proc)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label={`${t('common.remove')} ${proc}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        {t('categorySettings.footer')}
      </p>
    </section>
  )
}
