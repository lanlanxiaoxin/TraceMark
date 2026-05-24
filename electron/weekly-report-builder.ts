import { loadPromptFile } from './prompt-path'
import {
  formatDailySlicesForPrompt,
  loadDailySlicesForWeek,
  summarizeDailyCoverage
} from './daily-report-loader'
import {
  buildWeeklyEvidence,
  formatGitEvidenceForPrompt,
  formatProjectStatsForPrompt,
  formatWeekRangeLabel,
  type WeeklyEvidence
} from './report-evidence'
import { buildCategoryStats, buildOfflineGroupedByProject } from './report-offline'
import { weekBoundsFromStart } from './date-bounds'
import { listActivityLogsOverlapping } from './activity-logs'

export interface WeeklyContext {
  weekStartMs: number
  weekRangeLabel: string
  coverageLine: string
  dailyPromptText: string
  evidencePromptText: string
  fullPromptText: string
}

export async function buildWeeklyContext(weekStartMs: number): Promise<WeeklyContext> {
  const slices = await loadDailySlicesForWeek(weekStartMs)
  const coverage = summarizeDailyCoverage(slices)
  const evidence = await buildWeeklyEvidence(weekStartMs)
  const weekRangeLabel = formatWeekRangeLabel(weekStartMs)

  const dailyPromptText = formatDailySlicesForPrompt(slices)
  const evidencePromptText = [
    '## 辅助证据：整周时间分配（已过滤锁屏等噪声）',
    evidence.categoryStatsText,
    '',
    '## 辅助证据：项目周统计',
    formatProjectStatsForPrompt(evidence.projectStats),
    '',
    '## 辅助证据：Git（整周去重）',
    formatGitEvidenceForPrompt(evidence.gitByProject),
    '',
    '## 辅助证据：异常时段',
    evidence.anomalies.length > 0 ? evidence.anomalies.join('\n') : '无',
    '',
    '## 数据覆盖',
    coverage.coverageLine,
    evidence.activityLogTruncated
      ? `（活动记录共 ${evidence.activityLogCount} 条，已截断分析前 5000 条）`
      : `（活动记录 ${evidence.activityLogCount} 条）`
  ].join('\n')

  const fullPromptText = [
    `## 周报窗口：${weekRangeLabel}`,
    '',
    '## 日报覆盖',
    coverage.coverageLine,
    '',
    '## 每日摘要',
    dailyPromptText,
    '',
    evidencePromptText
  ].join('\n')

  return {
    weekStartMs,
    weekRangeLabel,
    coverageLine: coverage.coverageLine,
    dailyPromptText,
    evidencePromptText,
    fullPromptText
  }
}

export function buildOfflineWeeklyReport(ctx: WeeklyContext, evidence: WeeklyEvidence): string {
  const { start, end } = weekBoundsFromStart(ctx.weekStartMs)
  const { items } = listActivityLogsOverlapping(start, end, 5000)

  return `## 本周工作摘要（${ctx.weekRangeLabel}）

> 离线模式：基于日摘要汇总与活动统计，未调用 AI。

## 日报覆盖
${ctx.coverageLine}

## 每日摘要
${ctx.dailyPromptText}

## 项目汇总
${buildOfflineGroupedByProject(items)}

## 时间分配
${evidence.categoryStatsText || buildCategoryStats(items)}

## Git 活动
${formatGitEvidenceForPrompt(evidence.gitByProject)}

## 待确认项
${evidence.anomalies.length > 0 ? evidence.anomalies.join('\n') : '无'}
`
}

/** 上传预览用：摘要版 weekly context。 */
export async function buildWeeklyContextPreviewSummary(weekStartMs: number): Promise<{
  title: string
  coverageLine: string
  payloadSummary: string
}> {
  const ctx = await buildWeeklyContext(weekStartMs)
  const truncated =
    ctx.fullPromptText.length > 4000
      ? `${ctx.fullPromptText.slice(0, 4000)}\n\n…（预览已截断，生成时将发送完整上下文）`
      : ctx.fullPromptText

  return {
    title: `周报 — ${ctx.weekRangeLabel}`,
    coverageLine: ctx.coverageLine,
    payloadSummary: truncated
  }
}

export function loadWeeklyReportPrompt(contextText: string): string {
  const template = loadPromptFile('weekly-report-v3.md')
  return template.replace('{{weekly_context}}', contextText)
}
