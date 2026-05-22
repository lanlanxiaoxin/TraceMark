import { useState, useEffect, useCallback } from 'react'
import { FileText, Loader2, Sparkles, Download, BookOpen } from 'lucide-react'
import {
  generateDailyReport,
  generateWeeklyReport,
  getReportForPeriod,
  startOfWeek,
  exportMarkdown
} from '@/lib/reports'
import { dayBounds } from '@/lib/workAssets'
import { buildActivityReportPreview } from '@/lib/uploadPreview'
import { UploadPreviewDialog } from '@/components/UploadPreviewDialog'
import { ReportMarkdownView } from '@/components/ReportMarkdownView'
import type { UploadPreview } from '@/env'
import type { ProjectsIntent } from '@/pages/Projects'

type ReportType = 'daily' | 'weekly'

export interface ReportEditorIntent {
  type?: ReportType
  dateMs?: number
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
  const [reportType, setReportType] = useState<ReportType>(intent?.type ?? 'daily')
  const [dateMs, setDateMs] = useState(() => intent?.dateMs ?? Date.now())
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'ai' | 'offline' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [degraded, setDegraded] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [loadedFromHistory, setLoadedFromHistory] = useState(false)

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
    const report = await getReportForPeriod({
      type: reportType,
      dateStart: start,
      dateEnd: end
    })
    if (report) {
      setContent(report.content)
      setMode(null)
      setDegraded(null)
      setLoadedFromHistory(true)
    } else {
      setContent('')
      setMode(null)
      setDegraded(null)
      setLoadedFromHistory(false)
    }
  }, [reportType, reportPeriodBounds])

  useEffect(() => {
    void loadSavedForSelection()
  }, [loadSavedForSelection])

  useEffect(() => {
    if (!intent) return
    if (intent.type) setReportType(intent.type)
    if (intent.dateMs !== undefined) setDateMs(intent.dateMs)
    if (intent.type || intent.dateMs !== undefined) onIntentConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent])

  const openInRetro = (): void => {
    if (!onOpenProjects) return
    if (reportType === 'daily') {
      // 日报 → 包含该日的那一周复盘
      onOpenProjects({
        tab: 'retro',
        retroType: 'weekly',
        retroWeekStartMs: startOfWeek(dateMs)
      })
    } else {
      onOpenProjects({
        tab: 'retro',
        retroType: 'weekly',
        retroWeekStartMs: startOfWeek(dateMs)
      })
    }
  }

  const openPreview = async (): Promise<void> => {
    setError(null)
    const range = reportPeriodBounds()
    try {
      setPreview(await buildActivityReportPreview(range.start, range.end))
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加载上传预览')
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
      setLoadedFromHistory(false)
      if (result.degradedFromAi && result.degradationReason) {
        setDegraded(result.degradationReason)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    const prefix = reportType === 'daily' ? '日报' : '周报'
    const dateStr = new Date(dateMs).toISOString().slice(0, 10)
    const success = await exportMarkdown(content, `${prefix}-${dateStr}.md`)
    setExporting(false)
    if (!success) return // user cancelled
  }

  const dateInputValue = new Date(dateMs).toISOString().slice(0, 10)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">报告</h1>
          <p className="text-sm text-gray-500 mt-1">
            基于原始活动时间轴的辅助报告（旧版）。主流程请使用「项目 → 复盘」基于已确认工作资产。
          </p>
        </div>
        {onOpenProjects && (
          <button
            type="button"
            onClick={openInRetro}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            title="在复盘中打开本周"
          >
            <BookOpen className="w-4 h-4" />
            在复盘中打开本周
          </button>
        )}
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        此为 <strong>活动日志驱动</strong> 的日报/周报。PRO5.0 推荐在「今日」确认资产后，于「项目 → 复盘」生成周复盘或阶段复盘。
      </div>

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
            日报
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
            周报
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="report-date" className="block text-sm font-medium text-gray-700 mb-1">
              {reportType === 'daily' ? '日期' : '周起始日（周一）'}
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loading ? '生成中...' : '生成报告'}
          </button>
          {content && (
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? '导出中...' : '导出 Markdown'}
            </button>
          )}
        </div>

        {loadedFromHistory && content && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            已加载该{reportType === 'daily' ? '日' : '周'}窗口内最近一次保存的报告；可点击「生成报告」覆盖为新草稿。
          </p>
        )}
        {mode && (
          <p className="text-xs text-gray-500">
            {mode === 'offline' && !degraded ? '离线模式：未调用 AI' : mode === 'ai' ? '已由 AI 生成并保存为草稿' : '已生成本地摘要并保存为草稿'}
          </p>
        )}
        {degraded && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            云端 AI 不可用，已改用离线摘要：{degraded}
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
          <p className="text-gray-500">选择日期后点击「生成报告」</p>
          <p className="text-xs text-gray-400">
            请先在设置中配置 API Key，或开启离线模式查看结构化摘要
          </p>
        </div>
      )}

      <UploadPreviewDialog
        preview={preview}
        confirmLabel="确认并生成报告"
        onConfirm={() => void runGenerate()}
        onCancel={() => setPreview(null)}
        busy={loading}
      />
    </div>
  )
}
