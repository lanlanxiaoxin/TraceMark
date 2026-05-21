import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Search, Star } from 'lucide-react'
import type { AssetKind, AssetStatus, ProjectSpace, WorkAsset } from '@/env'
import { listProjectSpaces } from '@/lib/projectSpaces'
import { dayBounds, exportContent, listWorkAssets, updateWorkAsset } from '@/lib/workAssets'
import { workAssetsToJson, workAssetsToMarkdown } from '@/lib/assetExport'
import { EvidenceList } from '@/components/EvidenceList'

const KIND_OPTIONS: { value: AssetKind | ''; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'outcome', label: '成果' },
  { value: 'process', label: '过程' },
  { value: 'evidence', label: '证据' }
]

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: 'confirmed', label: '已确认' },
  { value: 'private', label: '私密' },
  { value: 'suggested', label: '待确认' },
  { value: 'ignored', label: '已忽略' }
]

const RANGE_DAYS = [
  { label: '近 7 天', days: 7 },
  { label: '近 30 天', days: 30 },
  { label: '近 90 天', days: 90 }
] as const

interface AssetLibraryProps {
  initialProjectId?: number | null
}

export function AssetLibrary({ initialProjectId }: AssetLibraryProps): JSX.Element {
  const [spaces, setSpaces] = useState<ProjectSpace[]>([])
  const [assets, setAssets] = useState<WorkAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [projectId, setProjectId] = useState<number | ''>(initialProjectId ?? '')
  const [status, setStatus] = useState<AssetStatus>('confirmed')
  const [assetKind, setAssetKind] = useState<AssetKind | ''>('')
  const [rangeDays, setRangeDays] = useState(30)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editImpact, setEditImpact] = useState('')

  useEffect(() => {
    void listProjectSpaces().then(setSpaces)
  }, [])

  useEffect(() => {
    if (initialProjectId !== undefined && initialProjectId !== null) {
      setProjectId(initialProjectId)
    }
  }, [initialProjectId])

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const projectById = useMemo(() => new Map(spaces.map(s => [s.id, s])), [spaces])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { end } = dayBounds(Date.now())
      const dateStart = end - rangeDays * 24 * 60 * 60 * 1000
      const filter: Parameters<typeof listWorkAssets>[0] = {
        status,
        dateStart,
        dateEnd: end,
        limit: 300
      }
      if (projectId !== '') filter.projectId = projectId
      if (assetKind) filter.assetKind = assetKind
      if (searchDebounced) filter.search = searchDebounced
      setAssets(await listWorkAssets(filter))
    } finally {
      setLoading(false)
    }
  }, [projectId, status, assetKind, rangeDays, searchDebounced])

  useEffect(() => {
    void load()
  }, [load])

  const toggleImportant = async (asset: WorkAsset): Promise<void> => {
    const tags = asset.tags.includes('important')
      ? asset.tags.filter(t => t !== 'important')
      : [...asset.tags, 'important']
    await updateWorkAsset(asset.id, { tags })
    await load()
  }

  const saveEdits = async (id: number): Promise<void> => {
    await updateWorkAsset(id, {
      description: editDesc || null,
      impact: editImpact || null
    })
    setEditingId(null)
    await load()
  }

  const confirmExport = (count: number): boolean => {
    return confirm(
      `将导出 ${count} 条资产（含标题、补充说明与证据摘要）。请勿将含敏感信息的导出文件分享给他人。继续？`
    )
  }

  const handleExportMd = async (): Promise<void> => {
    if (!confirmExport(assets.length)) return
    const md = workAssetsToMarkdown(assets, projectById)
    await exportContent(md, `work-assets-${Date.now()}.md`)
  }

  const handleExportJson = async (): Promise<void> => {
    if (!confirmExport(assets.length)) return
    await exportContent(workAssetsToJson(assets), `work-assets-${Date.now()}.json`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">资产库</h2>
        <p className="text-sm text-gray-500 mt-1">浏览、检索与导出已沉淀的工作资产</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGE_DAYS.map(r => (
          <button
            key={r.days}
            type="button"
            onClick={() => setRangeDays(r.days)}
            className={`px-3 py-1.5 text-xs rounded-lg border ${
              rangeDays === r.days
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-600'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value === '' ? '' : Number(e.target.value))}
          className="text-sm rounded-lg border border-gray-200 px-3 py-2"
          aria-label="项目筛选"
        >
          <option value="">全部项目</option>
          {spaces.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value as AssetStatus)}
          className="text-sm rounded-lg border border-gray-200 px-3 py-2"
          aria-label="状态筛选"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={assetKind}
          onChange={e => setAssetKind(e.target.value as AssetKind | '')}
          className="text-sm rounded-lg border border-gray-200 px-3 py-2"
          aria-label="类型筛选"
        >
          {KIND_OPTIONS.map(o => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索标题、补充、影响…"
            className="w-full text-sm rounded-lg border border-gray-200 pl-9 pr-3 py-2"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleExportMd()}
          disabled={assets.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          导出 Markdown
        </button>
        <button
          type="button"
          onClick={() => void handleExportJson()}
          disabled={assets.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          导出 JSON
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">没有匹配的资产</p>
      ) : (
        <ul className="space-y-2">
          {assets.map(asset => {
            const project =
              asset.projectId != null
                ? projectById.get(asset.projectId)?.name ?? '未知'
                : '未归类'
            const expanded = expandedId === asset.id
            const editing = editingId === asset.id
            return (
              <li key={asset.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {project}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {asset.assetKind}
                      </span>
                      {asset.tags.includes('important') && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          重要
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">{asset.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleImportant(asset)}
                    className={`p-2 rounded-lg shrink-0 ${
                      asset.tags.includes('important')
                        ? 'text-amber-600 bg-amber-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    aria-label={asset.tags.includes('important') ? '取消重要' : '标为重要'}
                  >
                    <Star
                      className="w-4 h-4"
                      fill={asset.tags.includes('important') ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
                {!editing && asset.description && (
                  <p className="text-xs text-gray-600 mt-2">{asset.description}</p>
                )}
                {!editing && asset.impact && (
                  <p className="text-xs text-gray-500 mt-1">影响：{asset.impact}</p>
                )}
                {editing && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="补充说明"
                      rows={2}
                      className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2"
                    />
                    <input
                      type="text"
                      value={editImpact}
                      onChange={e => setEditImpact(e.target.value)}
                      placeholder="影响 / 价值"
                      className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdits(asset.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : asset.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {expanded ? '收起证据' : '查看证据'}
                  </button>
                  {!editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(asset.id)
                        setEditDesc(asset.description ?? '')
                        setEditImpact(asset.impact ?? '')
                      }}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      编辑
                    </button>
                  )}
                </div>
                {expanded && <EvidenceList evidence={asset.evidence} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}