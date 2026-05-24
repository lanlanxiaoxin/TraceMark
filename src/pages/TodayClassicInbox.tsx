import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProjectSpace, WorkAsset } from '@/env'
import { listProjectSpaces } from '@/lib/projectSpaces'
import {
  confirmWorkAsset,
  dayBounds,
  generateSuggestedAssets,
  ignoreWorkAsset,
  listWorkAssets,
  markPrivateWorkAsset,
  mergeWorkAssets,
  onWorkAssetsUpdated,
  splitWorkAsset
} from '@/lib/workAssets'
import { restoreWorkAsset, snapshotWorkAsset, type WorkAssetUndoSnapshot } from '@/lib/workAssetUndo'
import { useUndoToast } from '@/hooks/useUndoToast'
import { WorkAssetCard } from '@/components/WorkAssetCard'
import { SplitWorkAssetDialog } from '@/components/SplitWorkAssetDialog'
import { EvidenceList } from '@/components/EvidenceList'
import { UndoToast } from '@/components/UndoToast'
import { DailyNarrativeCard } from '@/components/DailyNarrativeCard'
import type { ProjectsIntent } from '@/pages/Projects'
import type { TimelineIntent } from '@/env'
import { timelineIntentFromAsset } from '@/lib/timelineJump'
import { formatInboxDateLabel } from '@/lib/i18nFormat'

interface TodayClassicInboxProps {
  onNavigateProjects?: () => void
  onOpenProjects?: (intent: ProjectsIntent) => void
  onOpenTimeline?: (intent: TimelineIntent) => void
  onSwitchSeal?: () => void
}

function dayKey(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

type ProjectTabFilter = 'all' | 'unassigned' | number

function matchesProjectTab(asset: WorkAsset, tab: ProjectTabFilter): boolean {
  if (tab === 'all') return true
  if (tab === 'unassigned') return asset.projectId == null
  return asset.projectId === tab
}

export function TodayClassicInbox({
  onNavigateProjects,
  onOpenProjects,
  onOpenTimeline,
  onSwitchSeal
}: TodayClassicInboxProps): JSX.Element {
  const { t } = useTranslation()
  const jumpTimeline = (asset: WorkAsset): void => {
    onOpenTimeline?.(timelineIntentFromAsset(asset))
  }
  const [dateMs, setDateMs] = useState(() => dayKey(Date.now()))
  const [suggested, setSuggested] = useState<WorkAsset[]>([])
  const [confirmed, setConfirmed] = useState<WorkAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [splitAsset, setSplitAsset] = useState<WorkAsset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noProjects, setNoProjects] = useState(false)
  const [projectSpaces, setProjectSpaces] = useState<ProjectSpace[]>([])
  const [projectTab, setProjectTab] = useState<ProjectTabFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showConfirmed, setShowConfirmed] = useState(true)
  const { toast: undoToast, showUndo, dismiss: dismissUndo } = useUndoToast()
  const hasProjectsRef = useRef(false)

  const fetchLists = useCallback(async (targetDateMs: number) => {
    const { start, end } = dayBounds(targetDateMs)
    const [suggestedList, confirmedList] = await Promise.all([
      listWorkAssets({ status: 'suggested', dateStart: start, dateEnd: end }),
      listWorkAssets({ status: ['confirmed', 'private'], dateStart: start, dateEnd: end })
    ])
    setSuggested(suggestedList)
    setConfirmed(confirmedList)
    return { suggestedList, confirmedList }
  }, [])

  const undoRestore = useCallback(
    async (snapshots: WorkAssetUndoSnapshot[]) => {
      for (const snap of snapshots) {
        await restoreWorkAsset(snap)
      }
      await fetchLists(dateMs)
    },
    [dateMs, fetchLists]
  )

  const requestGenerate = useCallback(async (targetDateMs: number, force: boolean) => {
    if (!hasProjectsRef.current) return
    setGenerating(true)
    setError(null)
    try {
      const result = await generateSuggestedAssets(targetDateMs, force)
      if (result.status === 'ready') {
        setSuggested(result.items)
        setGenerating(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('today.errGenerate'))
      setGenerating(false)
    }
  }, [])

  const loadPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const projects = await listProjectSpaces()
      setProjectSpaces(projects)
      hasProjectsRef.current = projects.length > 0
      setNoProjects(projects.length === 0)

      const { start, end } = dayBounds(dateMs)
      const { suggestedList } = await fetchLists(dateMs)
      const anyForDay = await listWorkAssets({ dateStart: start, dateEnd: end, limit: 1 })

      if (suggestedList.length === 0 && projects.length > 0 && anyForDay.length === 0) {
        void requestGenerate(dateMs, false)
      } else {
        setGenerating(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('today.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [dateMs, fetchLists, requestGenerate])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    const unsubscribe = onWorkAssetsUpdated(payload => {
      if (dayKey(payload.dateMs) !== dayKey(dateMs)) return
      setSuggested(payload.suggested)
      setConfirmed(payload.confirmed)
      setGenerating(false)
    })
    return unsubscribe
  }, [dateMs])

  useEffect(() => {
    if (typeof projectTab === 'number' && !projectSpaces.some(p => p.id === projectTab)) {
      setProjectTab('all')
    }
  }, [projectSpaces, projectTab])

  const shiftDay = (delta: number): void => {
    const d = new Date(dateMs)
    d.setDate(d.getDate() + delta)
    setDateMs(dayKey(d.getTime()))
    setProjectTab('all')
    setSelectedIds(new Set())
    setGenerating(false)
    dismissUndo()
  }

  const handleRegenerate = (): void => {
    const ok = confirm(
      t('today.regenerateConfirm')
    )
    if (!ok) return
    dismissUndo()
    void requestGenerate(dateMs, true)
  }

  const handleConfirm = async (id: number, note?: string, title?: string): Promise<void> => {
    const asset = suggested.find(a => a.id === id)
    if (!asset) return
    const snapshot = snapshotWorkAsset(asset)
    setBusy(true)
    try {
      await confirmWorkAsset(id, {
        title,
        description: note || undefined,
        confidence: note ? 'high' : undefined
      })
      setSuggested(prev => prev.filter(a => a.id !== id))
      const { start, end } = dayBounds(dateMs)
      const confirmedList = await listWorkAssets({
        status: ['confirmed', 'private'],
        dateStart: start,
        dateEnd: end
      })
      setConfirmed(confirmedList)
      showUndo(t('today.undoConfirmed'), () => undoRestore([snapshot]))
    } finally {
      setBusy(false)
    }
  }

  const handleIgnore = async (id: number): Promise<void> => {
    const asset = suggested.find(a => a.id === id)
    if (!asset) return
    const snapshot = snapshotWorkAsset(asset)
    setBusy(true)
    try {
      await ignoreWorkAsset(id)
      setSuggested(prev => prev.filter(a => a.id !== id))
      showUndo(t('today.undoIgnored'), () => undoRestore([snapshot]))
    } finally {
      setBusy(false)
    }
  }

  const handlePrivate = async (id: number): Promise<void> => {
    const asset = suggested.find(a => a.id === id)
    if (!asset) return
    const snapshot = snapshotWorkAsset(asset)
    setBusy(true)
    try {
      await markPrivateWorkAsset(id)
      setSuggested(prev => prev.filter(a => a.id !== id))
      const { start, end } = dayBounds(dateMs)
      const confirmedList = await listWorkAssets({
        status: ['confirmed', 'private'],
        dateStart: start,
        dateEnd: end
      })
      setConfirmed(confirmedList)
      showUndo(t('today.undoPrivate'), () => undoRestore([snapshot]))
    } finally {
      setBusy(false)
    }
  }

  const openSplit = (id: number, draftTitle?: string): void => {
    const asset = suggested.find(a => a.id === id)
    if (!asset) return
    const title = draftTitle?.trim() || asset.title
    setSplitAsset(title === asset.title ? asset : { ...asset, title })
  }

  const confirmSplit = async (payload: {
    titleA: string
    titleB: string
    evidenceA: WorkAsset['evidence']
    evidenceB: WorkAsset['evidence']
  }): Promise<void> => {
    if (!splitAsset) return
    setBusy(true)
    setError(null)
    try {
      await splitWorkAsset(splitAsset.id, [
        {
          title: payload.titleA,
          assetKind: splitAsset.assetKind,
          evidence: payload.evidenceA
        },
        {
          title: payload.titleB,
          assetKind: 'process',
          evidence: payload.evidenceB
        }
      ])
      setSplitAsset(null)
      await fetchLists(dateMs)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('today.errSplit'))
    } finally {
      setBusy(false)
    }
  }

  const handleMerge = async (): Promise<void> => {
    const ids = [...selectedIds]
    if (ids.length < 2) return
    const snapshots = ids
      .map(id => suggested.find(a => a.id === id))
      .filter((a): a is WorkAsset => a !== undefined)
      .map(snapshotWorkAsset)
    if (snapshots.length < 2) return

    setBusy(true)
    try {
      await mergeWorkAssets(ids)
      setSelectedIds(new Set())
      await fetchLists(dateMs)
      showUndo(t('today.undoMerged', { count: snapshots.length }), () => undoRestore(snapshots))
    } finally {
      setBusy(false)
    }
  }

  const toggleSelect = (id: number, checked: boolean): void => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const showListSkeleton = loading || generating

  const suggestedFiltered = suggested.filter(a => matchesProjectTab(a, projectTab))
  const confirmedFiltered = confirmed.filter(a => matchesProjectTab(a, projectTab))
  const dayAssetCount = (tab: ProjectTabFilter): number => {
    const list = [...suggested, ...confirmed]
    return list.filter(a => matchesProjectTab(a, tab)).length
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('today.classicInbox')}</h1>
            <p className="text-sm text-gray-500">{t('today.classicSubtitle')}</p>
          </div>
          {onSwitchSeal && (
            <button
              type="button"
              onClick={onSwitchSeal}
              className="shrink-0 text-xs text-gray-600 underline hover:text-gray-900"
            >
              {t('today.backToSeal')}
            </button>
          )}
        </div>
      </header>

      {!noProjects && <DailyNarrativeCard dateMs={dateMs} />}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          aria-label={t('common.prevDay')}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-gray-900">{formatInboxDateLabel(dateMs)}</span>
        <button
          type="button"
          onClick={() => shiftDay(1)}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          aria-label={t('common.nextDay')}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          type="button"
          disabled={generating || noProjects}
          onClick={handleRegenerate}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {t('common.regenerate')}
        </button>
      </div>

      {generating && !loading && (
        <p className="text-xs text-gray-500 text-center">{t('today.generating')}</p>
      )}

      {noProjects && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t('today.noProjectsPrefix')}
          {onNavigateProjects ? (
            <button type="button" onClick={onNavigateProjects} className="font-medium underline">
              {t('common.createProjectSpace')}
            </button>
          ) : (
            t('common.createProjectSpace')
          )}
          {t('today.noProjectsSuffix')}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {!noProjects && projectSpaces.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          role="tablist"
          aria-label={t('today.filterByProject')}
        >
          {(
            [
              { key: 'all' as const, label: t('today.filterAll'), tab: 'all' as const },
              { key: 'unassigned' as const, label: t('today.filterUnassigned'), tab: 'unassigned' as const }
            ] as const
          ).map(({ key, label, tab }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={projectTab === tab}
              onClick={() => setProjectTab(tab)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                projectTab === tab
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
              <span className="ml-1 opacity-70">({dayAssetCount(tab)})</span>
            </button>
          ))}
          {projectSpaces.map(p => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={projectTab === p.id}
              onClick={() => setProjectTab(p.id)}
              className={`shrink-0 max-w-[140px] truncate rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                projectTab === p.id
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title={p.name}
            >
              {p.name}
              <span className="ml-1 opacity-70">({dayAssetCount(p.id)})</span>
            </button>
          ))}
        </div>
      )}

      {selectedIds.size >= 2 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleMerge()}
          className="w-full py-2 text-sm font-medium rounded-lg border border-gray-900 text-gray-900 hover:bg-gray-50"
        >
          {t('today.mergeSelected', { count: selectedIds.size })}
        </button>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {t('today.pendingSection', {
            shown: suggestedFiltered.length,
            totalSuffix:
              projectTab !== 'all'
                ? t('today.pendingTotalSuffix', { total: suggested.length })
                : ''
          })}
        </h2>
        {showListSkeleton ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : suggested.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-xl">
            {noProjects ? t('today.emptyNoProjects') : t('today.emptyNoSuggested')}
          </p>
        ) : suggestedFiltered.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl">
            {t('today.emptyFiltered')}
          </p>
        ) : (
          suggestedFiltered.map(asset => (
            <WorkAssetCard
              key={asset.id}
              asset={asset}
              selected={selectedIds.has(asset.id)}
              onSelect={toggleSelect}
              onConfirm={handleConfirm}
              onIgnore={handleIgnore}
              onPrivate={handlePrivate}
              onSplit={openSplit}
              onJumpTimeline={onOpenTimeline ? jumpTimeline : undefined}
              busy={busy}
            />
          ))
        )}
      </section>

      {confirmed.length > 0 && onOpenProjects && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenProjects({ tab: 'library' })}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            {t('today.viewInLibrary')}
          </button>
          <button
            type="button"
            onClick={() => onOpenProjects({ tab: 'retro' })}
            className="text-sm px-3 py-2 rounded-lg border border-gray-900 bg-gray-900 text-white"
          >
            {t('today.weeklyRetro')}
          </button>
        </div>
      )}

      <section className="space-y-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={() => setShowConfirmed(!showConfirmed)}
          className="flex items-center justify-between w-full text-sm font-semibold text-gray-700"
        >
          <span>
            {t('today.confirmedToday', {
              shown: confirmedFiltered.length,
              totalSuffix:
                projectTab !== 'all'
                  ? t('today.pendingTotalSuffix', { total: confirmed.length })
                  : ''
            })}
          </span>
          <span className="text-gray-400">
            {showConfirmed ? t('common.collapse') : t('common.expand')}
          </span>
        </button>
        {showConfirmed &&
          confirmedFiltered.map(asset => (
            <article key={asset.id} className="rounded-xl border border-green-100 bg-green-50/50 p-4">
              <h3 className="text-sm font-medium text-gray-900">{asset.title}</h3>
              {asset.impact && <p className="text-xs text-gray-600 mt-1">{asset.impact}</p>}
              <div className="mt-2">
                <EvidenceList evidence={asset.evidence} />
              </div>
            </article>
          ))}
      </section>

      <UndoToast toast={undoToast} onDismiss={dismissUndo} />

      <SplitWorkAssetDialog
        asset={splitAsset}
        onConfirm={payload => void confirmSplit(payload)}
        onCancel={() => setSplitAsset(null)}
        busy={busy}
      />
    </div>
  )
}