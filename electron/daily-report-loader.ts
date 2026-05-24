import { getDb } from './database'
import { weekBoundsFromStart } from './date-bounds'
import {
  buildDailyOfflineReportContent,
  offlineContentToDailySections
} from './report-offline'
import { parseDailyReportSections } from './report-sections'

export type DailySliceSource = 'saved_ai' | 'saved_offline' | 'generated_offline' | 'empty'

export interface DailyReportSlice {
  dateMs: number
  dateLabel: string
  source: DailySliceSource
  sections: {
    output: string
    timeAllocation: string
    pending: string
  }
  hasActivity: boolean
}

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDayLabel(dateMs: number): string {
  const d = new Date(dateMs)
  const dateStr = d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return `${dateStr}（${WEEKDAY[d.getDay()]}）`
}

function dayBoundsMs(dateMs: number): { start: number; end: number } {
  const start = new Date(dateMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateMs)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

function getSavedDailyReport(dateMs: number): { content: string } | null {
  const { start, end } = dayBoundsMs(dateMs)
  const db = getDb()
  const row = db
    .prepare(
      `SELECT content FROM reports
       WHERE type = 'daily' AND date_start = ? AND date_end = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(start, end) as { content: string } | undefined
  return row ?? null
}

function countActivityOnDay(dateMs: number): number {
  const { start, end } = dayBoundsMs(dateMs)
  const db = getDb()
  const row = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM activity_logs
       WHERE is_deleted = 0 AND started_at >= ? AND started_at <= ?`
    )
    .get(start, end) as { cnt: number }
  return row.cnt
}

function classifySavedSource(content: string): DailySliceSource {
  if (content.includes('离线模式') || content.includes('离线日摘要')) {
    return 'saved_offline'
  }
  return 'saved_ai'
}

async function buildSliceForDay(dateMs: number): Promise<DailyReportSlice> {
  const dateLabel = formatDayLabel(dateMs)
  const hasActivity = countActivityOnDay(dateMs) > 0
  const saved = getSavedDailyReport(dateMs)

  if (saved?.content.trim()) {
    const source = classifySavedSource(saved.content)
    const sections =
      source === 'saved_offline'
        ? offlineContentToDailySections(saved.content)
        : parseDailyReportSections(saved.content)
    return {
      dateMs,
      dateLabel,
      source,
      sections: {
        output: sections.output || '（该日报告无产出章节）',
        timeAllocation: sections.timeAllocation || '（无）',
        pending: sections.pending || '无'
      },
      hasActivity
    }
  }

  if (!hasActivity) {
    return {
      dateMs,
      dateLabel,
      source: 'empty',
      sections: {
        output: '（无活动记录）',
        timeAllocation: '（无）',
        pending: '无'
      },
      hasActivity: false
    }
  }

  const offlineContent = await buildDailyOfflineReportContent(dateMs)
  const sections = offlineContentToDailySections(offlineContent)
  return {
    dateMs,
    dateLabel,
    source: 'generated_offline',
    sections: {
      output: sections.output,
      timeAllocation: sections.timeAllocation,
      pending: sections.pending
    },
    hasActivity: true
  }
}

export async function loadDailySlicesForWeek(weekStartMs: number): Promise<DailyReportSlice[]> {
  const { start } = weekBoundsFromStart(weekStartMs)
  const slices: DailyReportSlice[] = []
  for (let i = 0; i < 7; i++) {
    const dayMs = start + i * 24 * 60 * 60 * 1000
    slices.push(await buildSliceForDay(dayMs))
  }
  return slices
}

export function summarizeDailyCoverage(slices: DailyReportSlice[]): {
  savedCount: number
  generatedOfflineCount: number
  emptyCount: number
  missingLabels: string[]
  coverageLine: string
} {
  const saved = slices.filter(s => s.source === 'saved_ai' || s.source === 'saved_offline')
  const generatedOffline = slices.filter(s => s.source === 'generated_offline')
  const empty = slices.filter(s => s.source === 'empty')
  const missingLabels = generatedOffline.map(s => s.dateLabel.split('（')[1]?.replace('）', '') ?? s.dateLabel)

  const coverageLine =
    empty.length === 7
      ? '本周无任何活动记录。'
      : `日报覆盖 ${saved.length}/7（已保存 ${saved.filter(s => s.source === 'saved_ai').length} 份 AI/正式日报）；` +
        (generatedOffline.length > 0
          ? `${generatedOffline.length} 天使用离线日摘要补齐${missingLabels.length ? `（${missingLabels.join('、')}）` : ''}。`
          : '全部 7 天均有日级摘要。')

  return {
    savedCount: saved.length,
    generatedOfflineCount: generatedOffline.length,
    emptyCount: empty.length,
    missingLabels,
    coverageLine
  }
}

export function formatDailySlicesForPrompt(slices: DailyReportSlice[]): string {
  return slices
    .map(s => {
      const sourceLabel =
        s.source === 'saved_ai'
          ? 'AI 日报'
          : s.source === 'saved_offline'
            ? '离线日报'
            : s.source === 'generated_offline'
              ? '离线日摘要（补齐）'
              : '无记录'
      return [
        `### ${s.dateLabel}｜${sourceLabel}`,
        '**今日产出**',
        s.sections.output,
        '',
        '**时间分配**',
        s.sections.timeAllocation,
        '',
        '**待确认**',
        s.sections.pending
      ].join('\n')
    })
    .join('\n\n')
}
