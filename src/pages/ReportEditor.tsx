import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2, Sparkles, Download, BookOpen, Image } from 'lucide-react'
import {
  generateDailyReport,
  generateWeeklyReport,
  getReportForPeriod,
  startOfWeek,
  exportMarkdown,
  saveReportPng
} from '@/lib/reports'
import { renderReportSharePngDataUrl } from '@/lib/reportShareImage'
import { getWeeklyMemoryCapsule } from '@/lib/weeklyMemoryCapsule'
import { renderWeeklyMemoryCapsulePngDataUrl } from '@/lib/weeklyMemoryCapsuleImage'
import { recordMetric } from '@/lib/metrics'
import { dayBounds } from '@/lib/workAssets'
import { getDailySeal } from '@/lib/todaySeal'
import { buildActivityReportPreview, buildSealDailyReportUploadPreview } from '@/lib/uploadPreview'
import { UploadPreviewDialog } from '@/components/UploadPreviewDialog'
import { ReportMarkdownView } from '@/components/ReportMarkdownView'
import type { DailySealRecord, UploadPreview } from '@/env'
import type { ProjectsIntent } from '@/pages/Projects'

type ReportType = 'daily' | 'weekly'

export interface ReportEditorIntent {
  type?: ReportType
  dateMs?: number
  /** 周五通知等场景：进入后自动触发生成 */
  autoGenerate?: boolean
}

interface ReportEditorProps {
  intent?: ReportEditorIntent
  onIntentConsumed?: () => void
  onOpenProjects?: (intent: ProjectsIntent) => void
}

export function ReportEditor({
  intent,
  onIntentConsumed,
  onOpenProjects
}: ReportEditorProps = {}): JSX.Element {
  const { t } = useTranslation()
  const [reportType, setReportType] = useState<ReportType>(intent?.type ?? 'daily')
  const [dateMs, setDateMs] = useState(() => intent?.dateMs ?? Date.now())
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'ai' | 'offline' | null>(null)
  const [reportSource, setReportSource] = useState<'seal' | 'legacy' | 'battle' | null>(null)
  const [reportVersion, setReportVersion] = useState<'v3' | 'v2' | 'battle-v3' | null>(null)
  const [dailySeal, setDailySeal] = useState<DailySealRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [degraded, setDegraded] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingImage, setExportingImage] = useState(false)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [loadedFromHistory, setLoadedFromHistory] = useState(false)
  const [pendingAutoGenerate, setPendingAutoGenerate] = useState(false)

  const reportPeriodBounds = useCallback((): { start: number; end: number } => {
    if (reportType === 'daily') {
      return dayBounds(dateMs)
    }
    const weekStart = startOfWeek(dateMs)
    const start = new Date(weekStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start: start.getTime(), end: end.getTime() }
  }, [reportType, dateMs])

  const loadSavedForSelection = useCallback(async () => {
    const { start, end } = reportPeriodBounds()
    const [report, seal] = await Promise.all([
      getReportForPeriod({
        type: reportType,
        dateStart: start,
        dateEnd: end
      }),
      reportType === 'daily' ? getDailySeal(dateMs) : Promise.resolve(null)
    ])
    setDailySeal(seal)
    if (report) {
      setContent(report.content)
      setMode(null)
      setReportSource(null)
      setReportVersion(null)
      setDegraded(null)
      setLoadedFromHistory(true)
    } else {
      setContent('')
      setMode(null)
      setReportSource(null)
      setReportVersion(null)
      setDegraded(null)
      setLoadedFromHistory(false)
    }
  }, [reportType, reportPeriodBounds, dateMs])

  useEffect(() => {
    void loadSavedForSelection()
  }, [loadSavedForSelection])

  useEffect(() => {
    if (!intent) return
    if (intent.type) setReportType(intent.type)
    if (intent.dateMs !== undefined) setDateMs(intent.dateMs)
    if (intent.autoGenerate) setPendingAutoGenerate(true)
    if (intent.type || intent.dateMs !== undefined || intent.autoGenerate) onIntentConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent])

  useEffect(() => {
    if (!pendingAutoGenerate) return
    setPendingAutoGenerate(false)
    const timerId = window.setTimeout(() => void runGenerate(), 400)
    return () => window.clearTimeout(timerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoGenerate, reportType, dateMs])

  const openInRetro = (): void => {
    if (!onOpenProjects) return
    onOpenProjects({
      tab: 'retro',
      retroType: 'weekly',
      retroWeekStartMs: startOfWeek(dateMs)
    })
  }

  const openPreview = async (): Promise<void> => {
    setError(null)
    try {
      if (reportType === 'daily') {
        setPreview(await buildSealDailyReportUploadPreview(dateMs))
      } else {
        const range = reportPeriodBounds()
        setPreview(await buildActivityReportPreview(range.start, range.end))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dailyNarrative.errPreview'))
    }
  }

  const runGenerate = async (): Promise<void> => {
    setPreview(null)
    setLoading(true)
    setError(null)
    setDegraded(null)
    try {
      const result =
        reportType === 'daily'
          ? await generateDailyReport(dateMs)
          : await generateWeeklyReport(startOfWeek(dateMs))
      setContent(result.content)
      setMode(result.mode)
      setReportSource(result.source ?? null)
      setReportVersion(result.reportVersion ?? null)
      setLoadedFromHistory(false)
      if (result.degradedFromAi && result.degradationReason) {
        setDegraded(result.degradationReason)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errGenerate'))
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    const prefix = reportType === 'daily' ? t('reports.daily') : t('reports.weekly')
    const dateStr = new Date(dateMs).toISOString().slice(0, 10)
    const success = await exportMarkdown(content, `${prefix}-${dateStr}.md`)
    setExporting(false)
    if (!success) return
    if (reportType === 'weekly') {
      void recordMetric('weekly_battle_exported', { format: 'markdown' })
    }
  }

  const handleExportImage = async (): Promise<void> => {
    setExportingImage(true)
    setError(null)
    try {
      const dateStr = new Date(dateMs).toISOString().slice(0, 10)
      if (reportType === 'weekly') {
        const capsule = await getWeeklyMemoryCapsule(startOfWeek(dateMs))
        const dataUrl = renderWeeklyMemoryCapsulePngDataUrl(capsule)
        if (!dataUrl) {
          setError(t('reports.errCapsule'))
          return
        }
        const success = await saveReportPng(dataUrl, t('reports.fileCapsule', { date: dateStr }))
        if (success) {
          void recordMetric('weekly_memory_capsule_exported', { weekStartMs: capsule.weekStartMs })
          void recordMetric('weekly_battle_exported', { format: 'image' })
        }
        return
      }
      if (!content) return
      const dataUrl = renderReportSharePngDataUrl(t('reports.shareTitleDaily'), content)
      if (!dataUrl) {
        setError(t('reports.errSharePng'))
        return
      }
      await saveReportPng(dataUrl, t('reports.fileDaily', { date: dateStr }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reports.errExportShare'))
    } finally {
      setExportingImage(false)
    }
  }

  const dateInputValue = new Date(dateMs).toISOString().slice(0, 10)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('reports.subtitle')}</p>
        </div>
        {onOpenProjects && (
          <button
            type="button"
            onClick={openInRetro}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            title={t('reports.openInRetroTitle')}
          >
            <BookOpen className="w-4 h-4" />
            {t('reports.openInRetro')}
          </button>
        )}
      </header>

      {reportType === 'daily' && dailySeal && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {t('reports.sealDone')}
          {dailySeal.skippedMainline
            ? t('reports.noMainline')
            : dailySeal.projectName
              ? t('reports.mainline', { name: dailySeal.projectName })
              : ''}
          {dailySeal.note.trim() ? ` · 「${dailySeal.note.trim().slice(0, 60)}」` : ''}
          {t('reports.sealGenHint')}
        </div>
      )}

      {reportType === 'daily' && !dailySeal && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('reports.noSealHint')}
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReportType('daily')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              reportType === 'daily'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('reports.daily')}
          </button>
          <button
            type="button"
            onClick={() => setReportType('weekly')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              reportType === 'weekly'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('reports.weekly')}
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="report-date" className="block text-sm font-medium text-gray-700 mb-1">
              {reportType === 'daily' ? t('reports.dateDaily') : t('reports.dateWeekly')}
            </label>
            <input
              id="report-date"
              type="date"
              value={dateInputValue}
              onChange={e => {
                const d = new Date(e.target.value)
                if (!Number.isNaN(d.getTime())) setDateMs(d.getTime())
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void openPreview()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {t('reports.uploadPreview')}
          </button>
          <button
            type="button"
            onClick={() => void runGenerate()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {loading
              ? t('common.generating')
              : reportType === 'weekly'
                ? t('reports.generateWeekly')
                : t('reports.generateDaily')}
          </button>
          {content && (
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? t('common.exporting') : t('reports.exportMarkdown')}
            </button>
          )}
          {(reportType === 'weekly' || content) && (
            <button
              type="button"
              onClick={() => void handleExportImage()}
              disabled={exportingImage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-sm font-medium hover:bg-indigo-100 disabled:opacity-50"
            >
              <Image className="w-4 h-4" aria-hidden />
              {exportingImage
                ? t('common.exporting')
                : reportType === 'weekly'
                  ? t('reports.exportCapsule')
                  : t('reports.exportShare')}
            </button>
          )}
        </div>

        {loadedFromHistory && content && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            {t('reports.loadedDraft', {
              period: reportType === 'daily' ? t('common.day') : t('common.week')
            })}
          </p>
        )}
        {mode && (
          <p className="text-xs text-gray-500">
            {reportVersion === 'battle-v3' && reportSource === 'battle'
              ? t('reports.badgeWeekly')
              : reportVersion === 'v3' && reportSource === 'seal'
                ? t('reports.badgeSealV3')
                : reportSource === 'legacy'
                  ? t('reports.badgeActivityV2')
                  : ''}
            {mode === 'offline' && !degraded
              ? t('reports.badgeOffline')
              : mode === 'ai'
                ? t('reports.badgeAi')
                : t('reports.badgeSaved')}
          </p>
        )}
        {degraded && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('reports.aiDegraded', { reason: degraded })}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </section>

      {content ? (
        <article className="bg-white rounded-xl border border-gray-200 p-6">
          <ReportMarkdownView content={content} />
        </article>
      ) : (
        <div className="text-center py-16 space-y-3">
          <FileText className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">{t('reports.emptyHint')}</p>
          <p className="text-xs text-gray-400">{t('reports.emptyFootnote')}</p>
        </div>
      )}

      <UploadPreviewDialog
        preview={preview}
        confirmLabel={t('reports.confirmGenerate')}
        onConfirm={() => void runGenerate()}
        onCancel={() => setPreview(null)}
        busy={loading}
      />
    </div>
  )
}
