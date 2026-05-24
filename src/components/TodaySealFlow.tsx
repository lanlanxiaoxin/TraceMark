import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Stamp } from 'lucide-react'
import type { ProjectSpace, TimelineIntent, TodayMainlineSuggestion, WorkAsset } from '@/env'
import { listProjectSpaces } from '@/lib/projectSpaces'
import {
  confirmWorkAsset,
  dayBounds,
  generateSuggestedAssets,
  ignoreWorkAsset,
  listWorkAssets,
  markPrivateWorkAsset
} from '@/lib/workAssets'
import { generateDailyReport } from '@/lib/reports'
import { recordMetric } from '@/lib/metrics'
import {
  projectDisplayName,
  saveDailySeal,
  suggestTodayMainline,
  todaySealResultToUpsert,
  type TodaySealResult
} from '@/lib/todaySeal'
import { SealGeneratingOverlay, type SealOverlayPhase } from '@/components/SealGeneratingOverlay'
import { WorkAssetCard } from '@/components/WorkAssetCard'
import { TodaySealSummaryCard } from '@/components/TodaySealSummaryCard'
import type { ProjectsIntent } from '@/pages/Projects'
import { timelineIntentFromAsset } from '@/lib/timelineJump'
import { formatInboxDateLabel } from '@/lib/i18nFormat'

interface TodaySealFlowProps {
  onNavigateProjects?: () => void
  onOpenProjects?: (intent: ProjectsIntent) => void
  onOpenTimeline?: (intent: TimelineIntent) => void
  onSwitchClassic?: () => void
  onOpenReports?: (dateMs: number) => void
}

type SealStep = 1 | 2 | 3

function dayKey(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function TodaySealFlow({
  onNavigateProjects,
  onOpenProjects,
  onOpenTimeline,
  onSwitchClassic,
  onOpenReports
}: TodaySealFlowProps): JSX.Element {
  const { t } = useTranslation()
  const stepLabel = (s: SealStep): string => {
    if (s === 1) return t('today.sealStep1')
    if (s === 2) return t('today.sealStep2')
    return t('today.sealStep3')
  }
  const jumpTimeline = (asset: WorkAsset): void => {
    onOpenTimeline?.(timelineIntentFromAsset(asset))
  }
  const [dateMs, setDateMs] = useState(() => dayKey(Date.now()))
  const [step, setStep] = useState<SealStep>(1)
  const [done, setDone] = useState<TodaySealResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [overlayPhase, setOverlayPhase] = useState<SealOverlayPhase | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [suggestion, setSuggestion] = useState<TodayMainlineSuggestion | null>(null)
  const [projectSpaces, setProjectSpaces] = useState<ProjectSpace[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [skippedMainline, setSkippedMainline] = useState(false)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [note, setNote] = useState('')

  const [suggested, setSuggested] = useState<WorkAsset[]>([])
  const [expandedEvidence, setExpandedEvidence] = useState(false)

  const startedAtRef = useRef<number>(Date.now())
  const lastStartedDateRef = useRef<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [suggest, projects, { start, end }] = await Promise.all([
        suggestTodayMainline(dateMs),
        listProjectSpaces(),
        Promise.resolve(dayBounds(dateMs))
      ])
      setSuggestion(suggest)
      setProjectSpaces(projects)
      setSelectedProjectId(suggest.projectId)
      setSkippedMainline(false)
      setShowProjectPicker(false)

      const suggestedList = await listWorkAssets({
        status: 'suggested',
        dateStart: start,
        dateEnd: end
      })
      setSuggested(suggestedList)

      if (suggestedList.length === 0 && projects.length > 0) {
        void generateSuggestedAssets(dateMs, false).catch(() => undefined)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('today.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [dateMs, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (lastStartedDateRef.current === dateMs) return
    lastStartedDateRef.current = dateMs
    startedAtRef.current = Date.now()
    void recordMetric('today_seal_started', { dateMs })
    setStep(1)
    setDone(null)
    setNote('')
    setExpandedEvidence(false)
  }, [dateMs])

  const shiftDay = (delta: number): void => {
    const d = new Date(dateMs)
    d.setDate(d.getDate() + delta)
    setDateMs(dayKey(d.getTime()))
  }

  const selectedProject = projectSpaces.find(p => p.id === selectedProjectId) ?? null
  const mainlineTitle =
    skippedMainline
      ? null
      : selectedProject
        ? projectDisplayName(selectedProject)
        : suggestion?.projectName ?? suggestion?.parsedProjectLabel ?? null

  const taskHint = skippedMainline ? null : suggestion?.taskHint

  const skipEntireSeal = (): void => {
    void recordMetric('today_seal_skipped', { dateMs })
    onSwitchClassic?.()
  }

  const confirmMainline = (): void => {
    setSkippedMainline(false)
    setStep(2)
  }

  const skipMainlineStep = (): void => {
    setSkippedMainline(true)
    setSelectedProjectId(null)
    setStep(2)
  }

  const goEvidence = (): void => {
    setStep(3)
  }

  const refreshSuggested = async (): Promise<WorkAsset[]> => {
    const { start, end } = dayBounds(dateMs)
    const list = await listWorkAssets({ status: 'suggested', dateStart: start, dateEnd: end })
    setSuggested(list)
    return list
  }

  const archiveAllSuggested = async (): Promise<number> => {
    setBusy(true)
    let count = 0
    try {
      const list = await refreshSuggested()
      for (const asset of list) {
        await confirmWorkAsset(asset.id)
        count += 1
      }
      await refreshSuggested()
    } finally {
      setBusy(false)
    }
    return count
  }

  const dismissAllSuggested = async (): Promise<number> => {
    setBusy(true)
    let count = 0
    try {
      const list = await refreshSuggested()
      for (const asset of list) {
        await ignoreWorkAsset(asset.id)
        count += 1
      }
      await refreshSuggested()
    } finally {
      setBusy(false)
    }
    return count
  }

  const completeSeal = async (archived: number, dismissed: number): Promise<void> => {
    setBusy(true)
    setError(null)
    setOverlayPhase('seal')
    const started = startedAtRef.current ?? Date.now()
    const evidenceSuggested = suggested.length + archived + dismissed

    const result: TodaySealResult = {
      dateMs,
      projectId: skippedMainline ? null : selectedProjectId,
      projectName: mainlineTitle,
      parsedProjectLabel: skippedMainline ? null : (suggestion?.parsedProjectLabel ?? null),
      taskHint: taskHint ?? null,
      note,
      skippedMainline,
      evidenceSuggested,
      evidenceArchived: archived,
      evidenceDismissed: dismissed,
      completedAt: Date.now()
    }

    try {
      await saveDailySeal(todaySealResultToUpsert(result))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('today.errSealSave'))
      setOverlayPhase(null)
      setBusy(false)
      return
    }

    let reportContent: string | undefined
    let reportMode: 'ai' | 'offline' | undefined
    let reportSource: 'seal' | 'legacy' | 'battle' | undefined
    setOverlayPhase('report')
    try {
      const report = await generateDailyReport(dateMs)
      reportContent = report.content
      reportMode = report.mode
      reportSource = report.source
      result.reportContent = reportContent
      result.reportMode = reportMode
      result.reportSource = reportSource
      result.reportVersion = report.reportVersion
    } catch {
      /* 日报生成失败不阻塞盖章 */
    }

    await recordMetric('today_seal_completed', {
      dateMs,
      durationMs: Date.now() - started
    })

    setOverlayPhase(null)
    setDone(result)
    setBusy(false)
  }

  const finishSeal = async (): Promise<void> => {
    await completeSeal(0, 0)
  }

  const finishWithArchive = async (): Promise<void> => {
    const n = await archiveAllSuggested()
    await completeSeal(n, 0)
  }

  const finishWithDismiss = async (): Promise<void> => {
    const n = await dismissAllSuggested()
    await completeSeal(0, n)
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <TodaySealSummaryCard
          result={done}
          onOpenReport={onOpenReports ? () => onOpenReports(done.dateMs) : undefined}
          onSealAgain={() => {
            setDone(null)
            setStep(1)
            lastStartedDateRef.current = null
            void loadData()
          }}
        />
        {onOpenProjects && (
          <button
            type="button"
            onClick={() => onOpenProjects({ tab: 'library' })}
            className="text-sm text-gray-600 underline"
          >
            {t('today.viewInLibraryShort')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {overlayPhase ? <SealGeneratingOverlay phase={overlayPhase} /> : null}
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stamp className="w-6 h-6 text-gray-800" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('today.sealTitle')}</h1>
              <p className="text-sm text-gray-500">{t('today.sealSubtitle')}</p>
            </div>
          </div>
          {onSwitchClassic && (
            <button
              type="button"
              onClick={onSwitchClassic}
              className="shrink-0 text-xs text-gray-600 underline hover:text-gray-900"
            >
              {t('today.classicMode')}
            </button>
          )}
        </div>

        <ol className="flex gap-2 text-xs" aria-label={t('today.sealStepsAria')}>
          {([1, 2, 3] as SealStep[]).map(s => (
            <li
              key={s}
              className={`flex-1 rounded-full py-1 text-center font-medium ${
                step === s
                  ? 'bg-gray-900 text-white'
                  : step > s
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s}. {stepLabel(s)}
            </li>
          ))}
        </ol>
      </header>

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
          onClick={skipEntireSeal}
          className="ml-auto text-xs text-gray-500 hover:text-gray-800 underline"
        >
          {t('today.skipSeal')}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
      ) : (
        <>
          {step === 1 && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('today.sealQ1')}</h2>
              {projectSpaces.length === 0 ? (
                <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
                  {t('today.noProjectYet')}{' '}
                  {onNavigateProjects ? (
                    <button type="button" onClick={onNavigateProjects} className="underline font-medium">
                      {t('common.goCreate')}
                    </button>
                  ) : (
                    t('today.createFirst')
                  )}
                </p>
              ) : (
                <>
                  <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 space-y-1">
                    {skippedMainline ? (
                      <p className="text-sm text-gray-600">{t('today.sealSkippedMainline')}</p>
                    ) : mainlineTitle ? (
                      <>
                        <p className="text-lg font-medium text-gray-900">{mainlineTitle}</p>
                        {taskHint && (
                          <p className="text-sm text-gray-600">{t('today.sealTaskHint', { hint: taskHint })}</p>
                        )}
                        {suggestion && suggestion.activityMinutes > 0 && (
                          <p className="text-xs text-gray-500">
                            {t('today.sealActivityMinutes', {
                              minutes: suggestion.activityMinutes
                            })}
                            {suggestion.confidence === 'low' ? t('today.sealLowConfidence') : ''}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">{t('today.sealLowActivity')}</p>
                    )}
                  </div>

                  {showProjectPicker && (
                    <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {projectSpaces.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(p.id)
                            setSkippedMainline(false)
                            setShowProjectPicker(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-50 ${
                            selectedProjectId === p.id ? 'bg-gray-100 font-medium' : ''
                          }`}
                        >
                          {projectDisplayName(p)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={confirmMainline}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                    >
                      {t('today.sealConfirmMainline')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProjectPicker(!showProjectPicker)}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      {t('today.sealChangeProject')}
                    </button>
                    <button
                      type="button"
                      onClick={skipMainlineStep}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800"
                    >
                      {t('common.skip')}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('today.sealOneLinerTitle')}</h2>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t('today.sealNotePlaceholder')}
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goEvidence}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                >
                  {t('common.next')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNote('')
                    goEvidence()
                  }}
                  className="px-4 py-2 text-sm text-gray-500"
                >
                  {t('common.skip')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm text-gray-500"
                >
                  {t('common.back')}
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('today.sealEvidenceTitle')}</h2>
              <p className="text-sm text-gray-600">{t('today.sealEvidenceBulk', { count: suggested.length })}</p>

              <button
                type="button"
                onClick={() => setExpandedEvidence(!expandedEvidence)}
                className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
              >
                {expandedEvidence ? (
                  <ChevronUp className="w-4 h-4" aria-hidden />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden />
                )}
                {expandedEvidence ? t('today.collapseList') : t('today.expandList')}
              </button>

              {expandedEvidence && (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {suggested.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">{t('today.sealNoSuggested')}</p>
                  ) : (
                    suggested.map(asset => (
                      <WorkAssetCard
                        key={asset.id}
                        asset={asset}
                        onConfirm={async id => {
                          await confirmWorkAsset(id)
                          await refreshSuggested()
                        }}
                        onIgnore={async id => {
                          await ignoreWorkAsset(id)
                          await refreshSuggested()
                        }}
                        onPrivate={async id => {
                          await markPrivateWorkAsset(id)
                          await refreshSuggested()
                        }}
                        onJumpTimeline={onOpenTimeline ? jumpTimeline : undefined}
                        busy={busy}
                      />
                    ))
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void finishSeal()}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
                >
                  {t('today.sealComplete')}
                </button>
                {suggested.length > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void finishWithArchive()}
                      className="px-4 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                    >
                      {t('today.sealConfirmAll', { count: suggested.length })}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void finishWithDismiss()}
                      className="px-4 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >
                      {t('today.sealIgnoreAll')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm text-gray-500 sm:ml-auto"
                >
                  {t('common.back')}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
