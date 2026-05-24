import type { ActivityLogRow } from './activity-logs'
import { listActivityLogs } from './activity-logs'
import { CATEGORY_LABELS, type ActivityCategory } from './window-title-parser'
import { collectGitCommitsForProjects } from './enrichment/git-enrichment'
import { extractMarkdownSection } from './report-sections'

export function formatReportTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDurationMinutes(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`
}

interface AggregatedActivity {
  category: ActivityCategory
  project: string | null
  file: string | null
  startedAt: number
  endedAt: number
}

export function aggregateActivities(logs: ActivityLogRow[]): AggregatedActivity[] {
  const sorted = [...logs].sort((a, b) => a.started_at - b.started_at)
  const result: AggregatedActivity[] = []

  for (const log of sorted) {
    const category = (log.category ?? 'other') as ActivityCategory
    const project = log.parsed_project
    const file = log.parsed_file
    const last = result[result.length - 1]

    if (
      last &&
      last.category === category &&
      last.project === project &&
      last.file === file &&
      log.started_at - last.endedAt < 5 * 60 * 1000
    ) {
      last.endedAt = log.ended_at
      continue
    }

    result.push({
      category,
      project,
      file,
      startedAt: log.started_at,
      endedAt: log.ended_at
    })
  }

  return result
}

export function buildCategoryStats(logs: ActivityLogRow[]): string {
  const totals = new Map<ActivityCategory, number>()
  for (const log of logs) {
    const cat = (log.category ?? 'other') as ActivityCategory
    totals.set(cat, (totals.get(cat) ?? 0) + (log.ended_at - log.started_at))
  }
  const totalMs = [...totals.values()].reduce((a, b) => a + b, 0) || 1
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, ms]) => {
      const pct = Math.round((ms / totalMs) * 100)
      return `- ${CATEGORY_LABELS[cat]}：${formatDurationMinutes(ms)}（${pct}%）`
    })
    .join('\n') || '（无记录）'
}

export function buildOfflineGroupedByProject(logs: ActivityLogRow[]): string {
  const agg = aggregateActivities(logs)
  if (agg.length === 0) return '（无记录）'

  type Bucket = { totalMs: number; byCat: Map<ActivityCategory, number>; files: Map<string, number> }
  const byProject = new Map<string, Bucket>()

  for (const a of agg) {
    const pk = a.project?.trim() ? a.project.trim() : '未标注项目'
    if (!byProject.has(pk)) {
      byProject.set(pk, { totalMs: 0, byCat: new Map(), files: new Map() })
    }
    const b = byProject.get(pk)!
    const ms = a.endedAt - a.startedAt
    b.totalMs += ms
    b.byCat.set(a.category, (b.byCat.get(a.category) ?? 0) + ms)
    if (a.file) {
      const base = a.file.split(/[/\\]/).pop() ?? a.file
      b.files.set(base, (b.files.get(base) ?? 0) + ms)
    }
  }

  const lines: string[] = []
  const sorted = [...byProject.entries()].sort((x, y) => y[1].totalMs - x[1].totalMs)
  for (const [proj, bucket] of sorted) {
    lines.push(`**${proj}**（${formatDurationMinutes(bucket.totalMs)}）`)
    const cats = [...bucket.byCat.entries()].sort((a, b) => b[1] - a[1])
    for (const [cat, ms] of cats) {
      lines.push(`- ${CATEGORY_LABELS[cat]}：${formatDurationMinutes(ms)}`)
    }
    const topFiles = [...bucket.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    if (topFiles.length > 0) {
      lines.push(
        `- 主要文件：` + topFiles.map(([f, ms]) => `${f}（${formatDurationMinutes(ms)}）`).join('、')
      )
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

export function buildLocalActivitySummaryLine(
  category: ActivityCategory,
  project: string | null,
  file: string | null,
  durationMs: number
): string {
  const label = CATEGORY_LABELS[category]
  const duration = formatDurationMinutes(durationMs)
  if (category === 'code_editor') {
    return `${file ?? project ?? '代码'} 开发（${duration}）`.slice(0, 80)
  }
  if (category === 'browser') {
    return `浏览器调研：${file ?? project ?? '资料'}（${duration}）`.slice(0, 80)
  }
  if (project) return `${label}：${project}（${duration}）`.slice(0, 80)
  return `${label}活动（${duration}）`.slice(0, 80)
}

export function buildOfflineReport(
  title: string,
  logs: ActivityLogRow[],
  sinceMs: number,
  gitSummary: string
): string {
  const dateLabel = new Date(sinceMs).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const agg = aggregateActivities(logs)
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
    .slice(0, 12)
    .map(x => x.line)
    .join('\n')

  const grouped = buildOfflineGroupedByProject(logs)

  return `## ${title}（${dateLabel}）

> 离线模式：未调用 AI，以下为结构化活动摘要。

## 时间分配
${buildCategoryStats(logs)}

## 按项目归类
${grouped}

## 主要工作块
${topBlocks || '（无记录）'}

## Git 活动
${gitSummary || '（无 Git 记录）'}
`
}

export async function buildDailyOfflineReportContent(dateMs: number): Promise<string> {
  const start = new Date(dateMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateMs)
  end.setHours(23, 59, 59, 999)

  const { items } = listActivityLogs({
    startTime: start.getTime(),
    endTime: end.getTime(),
    limit: 500
  })

  const projects = [...new Set(items.map(i => i.parsed_project).filter(Boolean))] as string[]
  const gitMap = await collectGitCommitsForProjects(projects, start.getTime())
  const gitSummary = [...gitMap.entries()]
    .flatMap(([, commits]) => commits.map(c => `- ${c.message}`))
    .join('\n')

  return buildOfflineReport('今日工作摘要', items, start.getTime(), gitSummary)
}

export function offlineContentToDailySections(content: string): {
  output: string
  timeAllocation: string
  pending: string
} {
  const grouped = extractMarkdownSection(content, '按项目归类')
  const blocks = extractMarkdownSection(content, '主要工作块')
  const output = [grouped, blocks].filter(Boolean).join('\n\n') || content.slice(0, 800)
  const timeAllocation = extractMarkdownSection(content, '时间分配') || '（无）'
  return {
    output,
    timeAllocation,
    pending: '无（离线日摘要）'
  }
}
