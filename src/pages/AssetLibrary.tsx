import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Search, Star } from 'lucide-react'
import type { AssetKind, AssetStatus, ProjectSpace, WorkAsset } from '@/env'
import { listProjectSpaces } from '@/lib/projectSpaces'
import type { TimelineIntent } from '@/env'
import { dayBounds, exportContent, listWorkAssets, updateWorkAsset } from '@/lib/workAssets'
import { searchWorkAssetsRecall } from '@/lib/assetSearch'
import { workAssetsToJson, workAssetsToMarkdown } from '@/lib/assetExport'
import { recordMetric } from '@/lib/metrics'
import { timelineIntentFromAsset } from '@/lib/timelineJump'
import { EvidenceList } from '@/components/EvidenceList'



interface AssetLibraryProps {
  initialProjectId?: number | null
  onOpenTimeline?: (intent: TimelineIntent) => void
}

export function AssetLibrary({ initialProjectId, onOpenTimeline }: AssetLibraryProps): JSX.Element {
  const { t } = useTranslation()
  const KIND_OPTIONS = useMemo(
    (): { value: AssetKind | ''; label: string }[] => [
      { value: '', label: t('assetLibrary.allKinds') },
      { value: 'outcome', label: t('workAsset.kindOutcome') },
      { value: 'process', label: t('workAsset.kindProcess') },
      { value: 'evidence', label: t('workAsset.kindEvidence') }
    ],
    [t]
  )
  const STATUS_OPTIONS = useMemo(
    (): { value: AssetStatus; label: string }[] => [
      { value: 'confirmed', label: t('assetLibrary.statusConfirmed') },
      { value: 'private', label: t('assetLibrary.statusPrivate') },
      { value: 'suggested', label: t('assetLibrary.statusSuggested') },
      { value: 'ignored', label: t('assetLibrary.statusIgnored') }
    ],
    [t]
  )
  const RANGE_DAYS = useMemo(
    (): { label: string; days: number }[] => [
      { label: t('assetLibrary.range7'), days: 7 },
      { label: t('assetLibrary.range30'), days: 30 },
      { label: t('assetLibrary.range90'), days: 90 }
    ],
    [t]
  )
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
      if (searchDebounced) {
        const recalled = await searchWorkAssetsRecall(searchDebounced, { limit: 300 })
        let filtered = recalled.items
        if (projectId !== '') filtered = filtered.filter(a => a.projectId === projectId)
        filtered = filtered.filter(a => a.status === status)
        if (assetKind) filtered = filtered.filter(a => a.assetKind === assetKind)
        setAssets(filtered)
      } else {
        setAssets(await listWorkAssets(filter))
      }
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
    return confirm(t('assetLibrary.exportConfirm', { count }))
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
        <h2 className="text-lg font-semibold text-gray-900">{t('assetLibrary.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('assetLibrary.subtitle')}</p>
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
          aria-label={t('assetLibrary.filterProject')}
        >
          <option value="">{t('assetLibrary.allProjects')}</option>
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
          aria-label={t('assetLibrary.filterStatus')}
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
          aria-label={t('assetLibrary.filterKind')}
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
            placeholder={t('assetLibrary.searchPlaceholder')}
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
          {t('assetLibrary.exportMarkdown')}
        </button>
        <button
          type="button"
          onClick={() => void handleExportJson()}
          disabled={assets.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          {t('assetLibrary.exportJson')}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">{t('assetLibrary.noMatch')}</p>
      ) : (
        <ul className="space-y-2">
          {assets.map(asset => {
            const project =
              asset.projectId != null
                ? projectById.get(asset.projectId)?.name ?? t('common.unknown')
                : t('common.unassigned')
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
                        {asset.assetKind === 'outcome'
                          ? t('workAsset.kindOutcome')
                          : asset.assetKind === 'process'
                            ? t('workAsset.kindProcess')
                            : t('workAsset.kindEvidence')}
                      </span>
                      {asset.tags.includes('important') && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          {t('common.important')}
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
                    aria-label={
                      asset.tags.includes('important')
                        ? t('assetLibrary.unmarkImportant')
                        : t('assetLibrary.markImportant')
                    }
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
                  <p className="text-xs text-gray-500 mt-1">
                    {t('assetLibrary.impact', { text: asset.impact })}
                  </p>
                )}
                {editing && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder={t('assetLibrary.placeholderNote')}
                      rows={2}
                      className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2"
                    />
                    <input
                      type="text"
                      value={editImpact}
                      onChange={e => setEditImpact(e.target.value)}
                      placeholder={t('assetLibrary.placeholderImpact')}
                      className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdits(asset.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = expanded ? null : asset.id
                      setExpandedId(next)
                      if (next != null) void recordMetric('asset_evidence_expanded', { assetId: asset.id })
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {expanded
                      ? t('workAsset.collapseEvidence')
                      : t('workAsset.expandEvidence', { count: asset.evidence.length })}
                  </button>
                  {onOpenTimeline &&
                    (asset.startedAt != null ||
                      asset.evidence.some(e => e.activityLogId != null || e.startedAt != null)) && (
                      <button
                        type="button"
                        onClick={() => {
                          void recordMetric('asset_timeline_jumped', {
                            assetId: asset.id,
                            startedAt: asset.startedAt ?? asset.createdAt
                          })
                          onOpenTimeline(timelineIntentFromAsset(asset))
                        }}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {t('workAsset.jumpTimeline')}
                      </button>
                    )}
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
                      {t('common.edit')}
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