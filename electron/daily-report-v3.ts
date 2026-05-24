import { listActivityLogs } from './activity-logs'
import { dayBounds } from './work-asset-generator'
import { listWorkAssets, type WorkAsset } from './work-assets'
import { getDailySeal, type DailySealRecord } from './daily-seal'
import { collectGitCommitsForProjects } from './enrichment/git-enrichment'
import { getProjectSpace } from './project-spaces'
import {
  aggregateActivities,
  buildCategoryStats,
  buildOfflineGroupedByProject,
  buildLocalActivitySummaryLine,
  formatDurationMinutes,
  formatReportTime
} from './report-offline'
import type { ActivityCategory } from './window-title-parser'

export function formatSealBlock(seal: DailySealRecord | null): string {
  if (!seal) return '（当日未完成今日盖章）'
  if (seal.skippedMainline) {
    const note = seal.note.trim()
    return [
      '- 主线：已跳过',
      note ? `- 一句话补充：**${note}**` : '- 一句话补充：（无）',
      `- 证据处理：候选 ${seal.evidenceSuggested} · 确认 ${seal.evidenceArchived} · 忽略 ${seal.evidenceDismissed}`
    ].join('\n')
  }
  const project =
    seal.projectName?.trim() ||
    seal.parsedProjectLabel?.trim() ||
    (seal.projectId != null ? getProjectSpace(seal.projectId)?.name : null) ||
    '（未识别项目）'
  const lines = [`- **主线项目**：${project}`]
  if (seal.taskHint?.trim()) lines.push(`- **任务侧重**：${seal.taskHint.trim()}`)
  const note = seal.note.trim()
  lines.push(note ? `- **一句话补充**：${note}` : '- **一句话补充**：（无）')
  lines.push(
    `- **证据处理**：候选 ${seal.evidenceSuggested} · 已确认 ${seal.evidenceArchived} · 已忽略 ${seal.evidenceDismissed}`
  )
  return lines.join('\n')
}

function listAssetsForDay(dateMs: number): WorkAsset[] {
  const { start, end } = dayBounds(dateMs)
  return listWorkAssets({
    dateStart: start,
    dateEnd: end,
    status: ['confirmed', 'private'],
    limit: 100
  })
}

function formatAssetBullets(assets: WorkAsset[], emptyLabel: string): string {
  if (assets.length === 0) return emptyLabel
  return assets
    .slice(0, 12)
    .map(a => {
      const impact = a.impact?.trim() ? ` — ${a.impact.trim()}` : ''
      const desc = a.description?.trim() ? `（${a.description.trim().slice(0, 80)}）` : ''
      return `- **${a.title}**${impact}${desc}`
    })
    .join('\n')
}

export function buildAssetsSectionForPrompt(dateMs: number): string {
  const assets = listAssetsForDay(dateMs)
  const outcomes = assets.filter(a => a.assetKind === 'outcome')
  const processes = assets.filter(a => a.assetKind === 'process')
  const evidence = assets.filter(a => a.assetKind === 'evidence')
  const parts: string[] = []
  if (outcomes.length > 0) {
    parts.push('### 成果类\n' + formatAssetBullets(outcomes, ''))
  }
  if (processes.length > 0) {
    parts.push('### 过程类\n' + formatAssetBullets(processes, ''))
  }
  if (evidence.length > 0) {
    parts.push('### 证据类\n' + formatAssetBullets(evidence, ''))
  }
  return parts.length > 0 ? parts.join('\n\n') : '（当日无已确认工作资产）'
}

export function buildActivitySummaryForPrompt(dateMs: number): string {
  const { start, end } = dayBounds(dateMs)
  const { items } = listActivityLogs({ startTime: start, endTime: end, limit: 500 })
  if (items.length === 0) return '（无前台活动记录）'

  const stats = buildCategoryStats(items)
  const grouped = buildOfflineGroupedByProject(items)
  const agg = aggregateActivities(items)
  const topBlocks = [...agg]
    .map(a => ({
      ms: a.endedAt - a.startedAt,
      line: `- ${formatReportTime(a.startedAt)}–${formatReportTime(a.endedAt)} | ${buildLocalActivitySummaryLine(
        a.category,
        a.project,
        a.file,
        a.endedAt - a.startedAt
      )}`
    }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 8)
    .map(x => x.line)
    .join('\n')

  return `### 时间分配\n${stats}\n\n### 按项目\n${grouped}\n\n### 主要时段\n${topBlocks || '（无）'}`
}

export async function buildTemplateDailyReportV3(dateMs: number): Promise<string> {
  const seal = getDailySeal(dateMs)
  const { start, end } = dayBounds(dateMs)
  const dateLabel = new Date(start).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })

  const { items: logs } = listActivityLogs({ startTime: start, endTime: end, limit: 500 })
  const projects = [...new Set(logs.map(i => i.parsed_project).filter(Boolean))] as string[]
  const gitMap = await collectGitCommitsForProjects(projects, start)
  const gitLines = [...gitMap.entries()].flatMap(([, commits]) =>
    commits.slice(0, 8).map(c => `- ${c.message}`)
  )
  const gitSection = gitLines.length > 0 ? gitLines.join('\n') : '（无 Git 提交记录）'

  const assets = listAssetsForDay(dateMs)
  const outcomes = assets.filter(a => a.assetKind === 'outcome')
  const processes = assets.filter(a => a.assetKind === 'process')

  const mainlineSection = formatSealBlock(seal)
  const note = seal?.note?.trim() ?? ''

  const outcomeBody =
    outcomes.length > 0
      ? formatAssetBullets(outcomes, '（无明确成果卡，见过程与活动摘要）')
      : gitLines.length > 0
        ? `### Git 提交\n${gitSection}`
        : '（今日无已确认成果卡；可从活动与 Git 摘要归纳，见下节）'

  const processBody =
    processes.length > 0
      ? formatAssetBullets(processes, '（无）')
      : (() => {
          const agg = aggregateActivities(logs)
          const lines = [...agg]
            .sort((a, b) => b.endedAt - b.startedAt - (a.endedAt - a.startedAt))
            .slice(0, 6)
            .map(
              a =>
                `- ${buildLocalActivitySummaryLine(
                  a.category as ActivityCategory,
                  a.project,
                  a.file,
                  a.endedAt - a.startedAt
                )}（${formatDurationMinutes(a.endedAt - a.startedAt)}）`
            )
          return lines.length > 0 ? lines.join('\n') : '（无显著过程记录）'
        })()

  const evidenceSection = [
    buildCategoryStats(logs),
    '',
    seal
      ? `盖章时候选证据 ${seal.evidenceSuggested} 条，已确认 ${seal.evidenceArchived} 条，忽略 ${seal.evidenceDismissed} 条。`
      : '（未完成盖章，仅活动统计）'
  ].join('\n')

  const tomorrowLines: string[] = []
  if (seal?.taskHint?.trim()) {
    tomorrowLines.push(`- 延续主线「${seal.taskHint.trim()}」的收尾与验证`)
  }
  const lowConf = assets.filter(a => a.confidence === 'low' || a.confidence === 'medium')
  if (lowConf.length > 0) {
    tomorrowLines.push(`- 待确认 ${lowConf.length} 项低置信度资产，建议明日补充一句话`)
  }
  if (tomorrowLines.length === 0) {
    tomorrowLines.push('- 根据本周节奏安排下一工作日优先级（待你补充）')
  }
  if (note) tomorrowLines.push(`- **备注（盖章）**：${note}`)

  return `## 日报 · ${dateLabel}

> 模板版 · 基于今日盖章 + 活动汇总（离线可生成）

## 今日主线
${mainlineSection}

## 成果
${outcomeBody}

## 过程
${processBody}

## 证据与活动
${evidenceSection}

## 明日与备注
${tomorrowLines.join('\n')}
`
}
