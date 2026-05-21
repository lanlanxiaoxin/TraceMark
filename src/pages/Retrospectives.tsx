import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Save, Sparkles } from 'lucide-react'
import type {
  ProjectSpace,
  RetroType,
  Retrospective,
  StoredReportSummary,
  UploadPreview,
  WorkAsset
} from '@/env'
import { listProjectSpaces } from '@/lib/projectSpaces'
import { exportContent, getWorkAsset } from '@/lib/workAssets'
import {
  currentWeekStartMs,
  deleteRetrospective,
  generateProjectPhaseRetro,
  generateWeeklyRetro,
  listRetrospectives,
  saveRetrospective,
  weekBounds
} from '@/lib/retrospectives'
import { listReportsInRange } from '@/lib/reports'
import { buildRetroPhasePreview, buildRetroWeeklyPreview } from '@/lib/uploadPreview'
import { UploadPreviewDialog } from '@/components/UploadPreviewDialog'
import type { ReportJumpRequest } from '@/pages/Projects'

interface RetrospectivesProps {
  initialProjectId?: number | null
  initialType?: RetroType
  initialWeekStartMs?: number
  initialPhaseStart?: number
  initialPhaseEnd?: number
  onPrefillConsumed?: () => void
  onOpenReports?: (req: ReportJumpRequest) => void
}

function formatWeekLabel(weekStartMs: number): string {
  const { start, end } = weekBounds(weekStartMs)
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function Retrospectives({
  initialProjectId,
  initialType,
  initialWeekStartMs,
  initialPhaseStart,
  initialPhaseEnd,
  onPrefillConsumed,
  onOpenReports
}: RetrospectivesProps): JSX.Element {
  const [spaces, setSpaces] = useState<ProjectSpace[]>([])
  const [saved, setSaved] = useState<Retrospective[]>([])
  const [retroType, setRetroType] = useState<RetroType>(initialType ?? 'weekly')
  const [projectId, setProjectId] = useState<number | ''>(initialProjectId ?? '')
  const [weekStart, setWeekStart] = useState(initialWeekStartMs ?? currentWeekStartMs())
  const [phaseStart, setPhaseStart] = useState(
    initialPhaseStart ??
      (() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })()
  )
  const [phaseEnd, setPhaseEnd] = useState(initialPhaseEnd ?? Date.now())
  const [content, setContent] = useState('')
  const [sourceIds, setSourceIds] = useState<number[]>([])
  const [usedReportIds, setUsedReportIds] = useState<number[]>([])
  const [includeReportIds, setIncludeReportIds] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<'ai' | 'offline' | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [degraded, setDegraded] = useState<string | null>(null)
  const [refAssets, setRefAssets] = useState<WorkAsset[]>([])
  const [periodReports, setPeriodReports] = useState<StoredReportSummary[]>([])

  useEffect(() => {
    if (initialProjectId !== undefined && initialProjectId !== null) {
      setProjectId(initialProjectId)
    }
  }, [initialProjectId])

  // 外部 intent 预填：设置完成后通知父级清空
  useEffect(() => {
    if (
      initialType ||
      initialWeekStartMs !== undefined ||
      initialPhaseStart !== undefined ||
      initialPhaseEnd !== undefined
    ) {
      if (initialType) setRetroType(initialType)
      if (initialWeekStartMs !== undefined) setWeekStart(initialWeekStartMs)
      if (initialPhaseStart !== undefined) setPhaseStart(initialPhaseStart)
      if (initialPhaseEnd !== undefined) setPhaseEnd(initialPhaseEnd)
      onPrefillConsumed?.()
    }
    // 仅当 initial* 变化时触发；onPrefillConsumed 稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialType, initialWeekStartMs, initialPhaseStart, initialPhaseEnd])

  useEffect(() => {
    if (sourceIds.length === 0) {
      setRefAssets([])
      return
    }
    void Promise.all(sourceIds.map(id => getWorkAsset(id))).then(list =>
      setRefAssets(list.filter((a): a is WorkAsset => a !== null))
    )
  }, [sourceIds])

  const currentBounds = useMemo(() => {
    return retroType === 'weekly'
      ? weekBounds(weekStart)
      : { start: phaseStart, end: phaseEnd }
  }, [retroType, weekStart, phaseStart, phaseEnd])

  const loadSaved = useCallback(async () => {
    const filter = projectId !== '' ? { projectId, limit: 20 } : { limit: 20 }
    setSaved(await listRetrospectives(filter))
  }, [projectId])

  useEffect(() => {
    void listProjectSpaces().then(setSpaces)
  }, [])

  useEffect(() => {
    void loadSaved()
  }, [loadSaved])

  // 拉取同期报告（按当前选定的时段）
  useEffect(() => {
    void listReportsInRange({
      dateStart: currentBounds.start,
      dateEnd: currentBounds.end,
      types: ['daily', 'weekly'],
      limit: 50
    }).then(list => {
      setPeriodReports(list)
      // 时段变化后，清空已选择的报告（避免跨周期残留）
      setIncludeReportIds(new Set())
    })
  }, [currentBounds.start, currentBounds.end])

  const shiftWeek = (delta: number): void => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d.getTime())
  }

  const openGeneratePreview = async (): Promise<void> => {
    setError(null)
    if (retroType === 'project_phase' && projectId === '') {
      setError('项目阶段复盘需选择项目')
      return
    }
    try {
      const p =
        retroType === 'weekly'
          ? await buildRetroWeeklyPreview(projectId === '' ? null : projectId, weekStart)
          : await buildRetroPhasePreview(projectId as number, phaseStart, phaseEnd)
      setPreview(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法加载上传预览')
    }
  }

  const runGenerate = async (): Promise<void> => {
    setPreview(null)
    setGenerating(true)
    setError(null)
    setDegraded(null)
    try {
      const extra = { includeReportIds: Array.from(includeReportIds) }
      if (retroType === 'weekly') {
        const pid = projectId === '' ? null : projectId
        const result = await generateWeeklyRetro(pid, weekStart, extra)
        setContent(result.content)
        setSourceIds(result.sourceAssetIds)
        setUsedReportIds(result.sourceReportIds)
        setMode(result.mode)
        if (result.degradedFromAi && result.degradationReason) {
          setDegraded(result.degradationReason)
        }
      } else {
        const result = await generateProjectPhaseRetro(
          projectId as number,
          phaseStart,
          phaseEnd,
          extra
        )
        setContent(result.content)
        setSourceIds(result.sourceAssetIds)
        setUsedReportIds(result.sourceReportIds)
        setMode(result.mode)
        if (result.degradedFromAi && result.degradationReason) {
          setDegraded(result.degradationReason)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      const dateRange =
        retroType === 'weekly' ? weekBounds(weekStart) : { start: phaseStart, end: phaseEnd }
      await saveRetrospective({
        projectId: projectId === '' ? null : projectId,
        type: retroType,
        dateStart: dateRange.start,
        dateEnd: dateRange.end,
        content,
        sourceAssetIds: sourceIds
      })
      await loadSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!content.trim()) return
    const name =
      retroType === 'weekly'
        ? `weekly-retro-${weekStart}.md`
        : `phase-retro-${projectId}-${phaseStart}.md`
    await exportContent(content, name)
  }

  const handleDeleteSaved = async (id: number): Promise<void> => {
    if (!confirm('删除这条复盘记录？')) return
    await deleteRetrospective(id)
    await loadSaved()
  }

  const toggleIncludeReport = (id: number): void => {
    setIncludeReportIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 报告跳转：定位到该报告的中位日期，让 ReportEditor 自动加载历史草稿
  const jumpToReport = (report: StoredReportSummary): void => {
    if (!onOpenReports) return
    const mid = report.date_start + Math.floor((report.date_end - report.date_start) / 2)
    onOpenReports({ type: report.type, dateMs: mid })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">复盘</h2>
        <p className="text-sm text-gray-500 mt-1">
          仅基于已确认的成果与过程资产生成；同期日报/周报仅作语气参考
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setRetroType('weekly')} className={`px-3 py-1.5 text-sm rounded-lg border ${retroType === 'weekly' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200'}`}>周复盘</button>
        <button type="button" onClick={() => setRetroType('project_phase')} className={`px-3 py-1.5 text-sm rounded-lg border ${retroType === 'project_phase' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200'}`}>项目阶段复盘</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={projectId} onChange={e => setProjectId(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm rounded-lg border border-gray-200 px-3 py-2" aria-label="项目">
          <option value="">{retroType === 'weekly' ? '全部项目' : '选择项目…'}</option>
          {spaces.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
        {retroType === 'weekly' ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-1">
            <button type="button" onClick={() => shiftWeek(-1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="上一周"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-gray-700">{formatWeekLabel(weekStart)}</span>
            <button type="button" onClick={() => shiftWeek(1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="下一周"><ChevronRight className="w-4 h-4" /></button>
          </div>
        ) : (
          <>
            <input type="date" value={new Date(phaseStart).toISOString().slice(0, 10)} onChange={e => { const d = new Date(e.target.value); d.setHours(0,0,0,0); setPhaseStart(d.getTime()) }} className="text-sm rounded-lg border border-gray-200 px-3 py-2" aria-label="阶段开始" />
            <input type="date" value={new Date(phaseEnd).toISOString().slice(0, 10)} onChange={e => { const d = new Date(e.target.value); d.setHours(23,59,59,999); setPhaseEnd(d.getTime()) }} className="text-sm rounded-lg border border-gray-200 px-3 py-2" aria-label="阶段结束" />
          </>
        )}
      </div>

      {/* 同期报告区：勾选后可作为佐证送入 prompt */}
      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            同期报告（{periodReports.length}）
          </h3>
          {periodReports.length > 0 && (
            <span className="text-xs text-gray-500">
              勾选后将作为「用户口径补充」送入 AI；不影响离线模式
            </span>
          )}
        </div>
        {periodReports.length === 0 ? (
          <p className="text-xs text-gray-500">
            该时段尚无保存的日报/周报。可在「报告」页生成后再回来复盘。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {periodReports.map(r => {
              const checked = includeReportIds.has(r.id)
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIncludeReport(r.id)}
                      className="shrink-0"
                    />
                    <span className="text-gray-800 truncate">
                      <span className="inline-block px-1.5 py-0.5 mr-2 text-[10px] uppercase tracking-wide rounded bg-gray-100 text-gray-600">
                        {r.type === 'daily' ? '日报' : '周报'}
                      </span>
                      {formatShortDate(r.date_start)}
                      {r.type === 'weekly' && ` – ${formatShortDate(r.date_end)}`}
                    </span>
                  </label>
                  {onOpenReports && (
                    <button
                      type="button"
                      onClick={() => jumpToReport(r)}
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      aria-label="在报告中查看"
                    >
                      在报告中查看 <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void openGeneratePreview()} disabled={generating} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-50"><Sparkles className="w-4 h-4" />{generating ? '生成中…' : '生成复盘'}</button>
        <button type="button" onClick={() => void handleSave()} disabled={!content.trim() || saving} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40"><Save className="w-4 h-4" />保存记录</button>
        <button type="button" onClick={() => void handleExport()} disabled={!content.trim()} className="text-sm px-3 py-2 rounded-lg border border-gray-200 disabled:opacity-40">导出 Markdown</button>
      </div>
      {mode && (
        <p className="text-xs text-gray-500">
          <span
            className={`inline-block px-2 py-0.5 rounded-full mr-2 ${
              mode === 'ai' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {mode === 'ai' ? 'AI 生成' : '离线模板'}
          </span>
          {sourceIds.length > 0 && `引用 ${sourceIds.length} 条已确认资产`}
          {usedReportIds.length > 0 && ` · 引用 ${usedReportIds.length} 份同期报告`}
        </p>
      )}
      {degraded && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2" role="status">
          AI 调用失败，已降级为离线模板：{degraded}
        </p>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{error}</p>}
      {refAssets.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <summary className="text-sm font-medium text-gray-800 cursor-pointer">
            引用资产（{refAssets.length}）
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {refAssets.map(a => (
              <li key={a.id}>
                [{a.assetKind}] {a.title}
              </li>
            ))}
          </ul>
        </details>
      )}
      <UploadPreviewDialog
        preview={preview}
        onConfirm={() => void runGenerate()}
        onCancel={() => setPreview(null)}
        busy={generating}
      />
      <textarea value={content} onChange={e => setContent(e.target.value)} rows={16} placeholder="点击「生成复盘」后在此编辑…" className="w-full text-sm font-mono rounded-xl border border-gray-200 px-4 py-3" />

      {/* 同期产出统一时间轴：日报 / 周报 / 复盘 */}
      <PeriodTimeline
        windowStart={currentBounds.start}
        windowEnd={currentBounds.end}
        reports={periodReports}
        retros={saved}
        onJumpReport={onOpenReports ? jumpToReport : undefined}
      />

      {saved.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">历史复盘</h3>
          <ul className="space-y-2">
            {saved.map(r => (
              <li key={r.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-2">
                <button type="button" onClick={() => { setContent(r.content); setSourceIds(r.sourceAssetIds); setRetroType(r.type); if (r.projectId != null) setProjectId(r.projectId) }} className="text-left text-sm text-gray-800 hover:underline min-w-0 flex-1 truncate">{r.type === 'weekly' ? '周复盘' : '阶段复盘'} · {new Date(r.dateStart).toLocaleDateString('zh-CN')}</button>
                <button type="button" onClick={() => void handleDeleteSaved(r.id)} className="text-xs text-red-600 shrink-0">删除</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

interface PeriodTimelineProps {
  windowStart: number
  windowEnd: number
  reports: StoredReportSummary[]
  retros: Retrospective[]
  onJumpReport?: (report: StoredReportSummary) => void
}

type TimelineItem =
  | { kind: 'daily' | 'weekly'; ts: number; report: StoredReportSummary }
  | { kind: 'retro'; ts: number; retro: Retrospective }

function PeriodTimeline({
  windowStart,
  windowEnd,
  reports,
  retros,
  onJumpReport
}: PeriodTimelineProps): JSX.Element {
  const items = useMemo<TimelineItem[]>(() => {
    const list: TimelineItem[] = []
    for (const r of reports) {
      list.push({ kind: r.type, ts: r.date_start, report: r })
    }
    for (const r of retros) {
      const overlaps = r.dateStart <= windowEnd && r.dateEnd >= windowStart
      if (!overlaps) continue
      list.push({ kind: 'retro', ts: r.dateStart, retro: r })
    }
    list.sort((a, b) => b.ts - a.ts)
    return list
  }, [reports, retros, windowStart, windowEnd])

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500">
        同期产出时间轴：该时段尚无日报、周报或复盘。
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">同期产出时间轴</h3>
      <ul className="space-y-1.5 text-sm">
        {items.map(it => {
          if (it.kind === 'retro') {
            return (
              <li key={`retro-${it.retro.id}`} className="flex items-center gap-2 text-gray-700">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs text-gray-500 w-16 shrink-0">
                  {formatShortDate(it.retro.dateStart)}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 shrink-0">
                  {it.retro.type === 'weekly' ? '周复盘' : '阶段复盘'}
                </span>
                <span className="truncate">
                  {it.retro.content.split('\n')[0]?.replace(/^#+\s*/, '') || '（未命名复盘）'}
                </span>
              </li>
            )
          }
          const r = it.report
          return (
            <li key={`report-${r.id}`} className="flex items-center gap-2 text-gray-700">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  r.type === 'daily' ? 'bg-blue-500' : 'bg-purple-500'
                }`}
              />
              <span className="text-xs text-gray-500 w-16 shrink-0">
                {formatShortDate(r.date_start)}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0 ${
                  r.type === 'daily'
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-purple-700 bg-purple-50'
                }`}
              >
                {r.type === 'daily' ? '日报' : '周报'}
              </span>
              <span className="truncate">{r.content.split('\n')[0]?.replace(/^#+\s*/, '') || '（未命名）'}</span>
              {onJumpReport && (
                <button
                  type="button"
                  onClick={() => onJumpReport(r)}
                  className="ml-auto shrink-0 text-xs text-blue-600 hover:underline"
                >
                  打开
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
