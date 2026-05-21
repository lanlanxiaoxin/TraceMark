import { useCallback, useEffect, useRef, useState } from 'react'
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

interface TodayInboxProps {
  onNavigateProjects?: () => void
  onOpenProjects?: (intent: ProjectsIntent) => void
}

function formatDateLabel(ms: number): string {
  const d = new Date(ms)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(ms)
  target.setHours(0, 0, 0, 0)
  if (target.getTime() === today.getTime()) return '今天'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
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

export function TodayInbox({ onNavigateProjects, onOpenProjects }: TodayInboxProps): JSX.Element {
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
      setError(e instanceof Error ? e.message : '生成失败')
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
      setError(e instanceof Error ? e.message : '加载失败')
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
      '重新生成将按最新活动更新「待确认」候选卡；已确认、忽略、私密及你编辑过的卡片不会被覆盖。继续？'
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
      showUndo('已确认', () => undoRestore([snapshot]))
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
      showUndo('已忽略', () => undoRestore([snapshot]))
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
      showUndo('已标为私密', () => undoRestore([snapshot]))
    } finally {
      setBusy(false)
    }
  }

  const openSplit = (id: number): void => {
    const asset = suggested.find(a => a.id === id)
    if (asset) setSplitAsset(asset)
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
      setError(e instanceof Error ? e.message : '拆分失败')
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
      showUndo(`已合并 ${snapshots.length} 张卡片`, () => undoRestore(snapshots))
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
        <h1 className="text-2xl font-bold text-gray-900">今日</h1>
        <p className="text-sm text-gray-500">确认候选工作资产，沉淀到项目知识库</p>
      </header>

      {!noProjects && <DailyNarrativeCard dateMs={dateMs} />}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          aria-label="前一天"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-gray-900">{formatDateLabel(dateMs)}</span>
        <button
          type="button"
          onClick={() => shiftDay(1)}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          aria-label="后一天"
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
          重新生成
        </button>
      </div>

      {generating && !loading && (
        <p className="text-xs text-gray-500 text-center">正在后台生成候选卡片…</p>
      )}

      {noProjects && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          请先{' '}
          {onNavigateProjects ? (
            <button type="button" onClick={onNavigateProjects} className="font-medium underline">
              创建项目空间
            </button>
          ) : (
            '创建项目空间'
          )}
          ，以便将活动归属到项目并生成候选卡片。
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
          aria-label="按项目筛选"
        >
          {(
            [
              { key: 'all' as const, label: '全部', tab: 'all' as const },
              { key: 'unassigned', label: '未归属', tab: 'unassigned' as const }
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
          合并选中的 {selectedIds.size} 张卡片
        </button>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          待确认（{suggestedFiltered.length}
          {projectTab !== 'all' ? ` / 共 ${suggested.length}` : ''}）
        </h2>
        {showListSkeleton ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : suggested.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-xl">
            {noProjects ? '创建项目空间后，系统将根据活动生成候选卡片' : '暂无候选卡片，可点击重新生成'}
          </p>
        ) : suggestedFiltered.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl">
            当前筛选下没有待确认卡片，可切换到「全部」或其他项目。
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
            在资产库中查看
          </button>
          <button
            type="button"
            onClick={() => onOpenProjects({ tab: 'retro' })}
            className="text-sm px-3 py-2 rounded-lg border border-gray-900 bg-gray-900 text-white"
          >
            生成本周复盘
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
            今日已确认（{confirmedFiltered.length}
            {projectTab !== 'all' ? ` / 共 ${confirmed.length}` : ''}）
          </span>
          <span className="text-gray-400">{showConfirmed ? '收起' : '展开'}</span>
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