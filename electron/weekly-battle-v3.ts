import { listDailySealsBetween, type DailySealRecord } from './daily-seal'
import { weekBoundsFromStart } from './date-bounds'
import { formatWeekRangeLabel, buildWeeklyEvidence } from './report-evidence'
import { listWorkAssets, type WorkAsset } from './work-assets'
import { formatGitEvidenceForPrompt } from './report-evidence'
import { getProjectSpace } from './project-spaces'
import { loadLocalizedPrompt } from './report-prompts'

function listConfirmedAssetsForWeek(weekStartMs: number): WorkAsset[] {
  const { start, end } = weekBoundsFromStart(weekStartMs)
  return listWorkAssets({
    status: ['confirmed', 'private'],
    dateStart: start,
    dateEnd: end,
    limit: 200
  })
}

function formatAssetLines(assets: WorkAsset[], empty: string): string {
  if (assets.length === 0) return empty
  return assets
    .slice(0, 15)
    .map(a => {
      const proj =
        a.projectId != null ? getProjectSpace(a.projectId)?.name ?? '' : ''
      const prefix = proj ? `[${proj}] ` : ''
      const impact = a.impact?.trim() ? ` — ${a.impact.trim()}` : ''
      return `- ${prefix}**${a.title}**${impact}`
    })
    .join('\n')
}

function formatSealLines(seals: DailySealRecord[]): string {
  if (seals.length === 0) return '（本周无盖章记录）'
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' })
  return seals
    .map(s => {
      if (s.skippedMainline) {
        const note = s.note.trim() ? ` · ${s.note.trim().slice(0, 60)}` : ''
        return `- ${fmt(s.dateMs)}：已跳过主线${note}`
      }
      const project = s.projectName?.trim() || s.parsedProjectLabel?.trim() || '未指定项目'
      const task = s.taskHint?.trim() ? ` · ${s.taskHint.trim()}` : ''
      const note = s.note.trim() ? ` · 「${s.note.trim().slice(0, 50)}」` : ''
      return `- ${fmt(s.dateMs)}：**${project}**${task}${note}`
    })
    .join('\n')
}

export function hasWeeklyBattleData(weekStartMs: number): boolean {
  const assets = listConfirmedAssetsForWeek(weekStartMs)
  if (assets.length > 0) return true
  const { start, end } = weekBoundsFromStart(weekStartMs)
  return listDailySealsBetween(start, end).length > 0
}

export function buildAssetsSectionForBattle(weekStartMs: number): string {
  const assets = listConfirmedAssetsForWeek(weekStartMs)
  const outcomes = assets.filter(a => a.assetKind === 'outcome')
  const processes = assets.filter(a => a.assetKind === 'process')
  const parts: string[] = []
  parts.push('### 成果类\n' + formatAssetLines(outcomes, '（无）'))
  parts.push('### 过程类\n' + formatAssetLines(processes, '（无）'))
  parts.push(`\n合计已确认 **${assets.length}** 张资产卡。`)
  return parts.join('\n\n')
}

export function buildSealsSectionForBattle(weekStartMs: number): string {
  const { start, end } = weekBoundsFromStart(weekStartMs)
  return formatSealLines(listDailySealsBetween(start, end))
}

export async function buildActivityGitSectionForBattle(weekStartMs: number): Promise<string> {
  const evidence = await buildWeeklyEvidence(weekStartMs)
  return [
    evidence.categoryStatsText ? `**时间分布**\n${evidence.categoryStatsText}` : '',
    `**Git**\n${formatGitEvidenceForPrompt(evidence.gitByProject)}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function buildTemplateWeeklyBattle(weekStartMs: number): Promise<string> {
  const weekLabel = formatWeekRangeLabel(weekStartMs)
  const assets = listConfirmedAssetsForWeek(weekStartMs)
  const { start, end } = weekBoundsFromStart(weekStartMs)
  const seals = listDailySealsBetween(start, end)

  const outcomes = assets.filter(a => a.assetKind === 'outcome')
  const highValue = assets.filter(
    a => a.assetKind === 'outcome' && (a.confidence === 'high' || (a.impact?.trim().length ?? 0) > 0)
  )
  const processes = assets.filter(a => a.assetKind === 'process')
  const sealHighlights = seals
    .filter(s => s.note.trim().length > 0)
    .map(s => `- ${new Date(s.dateMs).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}：${s.note.trim().slice(0, 80)}`)

  const evidence = await buildWeeklyEvidence(weekStartMs)

  return `## 本周战报（${weekLabel}）

> 基于本周 **${assets.length}** 张已确认资产与 **${seals.length}** 次今日盖章生成（模板版，可 AI 润色）。

### 本周成果

${formatAssetLines(outcomes, '（本周暂无成果类资产，建议在「今日」多确认候选卡）')}

### 本周突破

${formatAssetLines(highValue.length > 0 ? highValue : outcomes.slice(0, 5), '（可从成果卡或盖章一句话中提炼）')}

${sealHighlights.length > 0 ? sealHighlights.join('\n') : ''}

### 卡点与下周

${formatAssetLines(processes, '（暂无明确过程卡；回顾本周活动后自行补充）')}

### 数据概览

- 盖章 **${seals.length}** / 7 天 · 已确认资产 **${assets.length}** 张
- ${evidence.categoryStatsText ? evidence.categoryStatsText.split('\n')[0] ?? '' : '（活动统计见下）'}

### 本周盖章回顾

${formatSealLines(seals)}

### 活动与 Git（摘要）

${evidence.categoryStatsText || '（无活动统计）'}

${formatGitEvidenceForPrompt(evidence.gitByProject)}
`
}

export function buildWeeklyBattlePrompt(
  weekStartMs: number,
  templateDraft: string,
  activityGit: string
): string {
  const template = loadLocalizedPrompt('weekly-battle-v1.md')
  return template
    .replace('{{week_range}}', formatWeekRangeLabel(weekStartMs))
    .replace('{{assets_section}}', buildAssetsSectionForBattle(weekStartMs))
    .replace('{{seals_section}}', buildSealsSectionForBattle(weekStartMs))
    .replace('{{activity_git_section}}', activityGit)
    .replace('{{template_draft}}', templateDraft.slice(0, 8000))
}
