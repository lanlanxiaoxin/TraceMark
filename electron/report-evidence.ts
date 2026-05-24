import { listActivityLogsOverlapping, type ActivityLogRow } from './activity-logs'
import { CATEGORY_LABELS, type ActivityCategory } from './window-title-parser'
import {
  collectGitCommitsForProjects,
  loadAllGitDiffSnapshots
} from './enrichment/git-enrichment'
import { formatDurationMinutes, formatReportTime } from './report-offline'
import { weekBoundsFromStart } from './date-bounds'

const LOCK_SCREEN_RE = /锁屏|lock\s*screen|loginui|logonui/i
const LONG_OTHER_MS = 4 * 60 * 60 * 1000

export interface ProjectWeekStat {
  project: string
  codeMs: number
  totalMs: number
  topCategories: string[]
}

export interface GitWeekEvidence {
  project: string
  commits: string[]
  filesChanged: number
  insertions: number
  deletions: number
}

export interface WeeklyEvidence {
  projectStats: ProjectWeekStat[]
  gitByProject: GitWeekEvidence[]
  categoryStatsText: string
  anomalies: string[]
  activityLogCount: number
  activityLogTruncated: boolean
}

function isNoiseLog(log: ActivityLogRow): boolean {
  const title = `${log.sanitized_title ?? ''} ${log.window_title ?? ''} ${log.process_name ?? ''}`
  return LOCK_SCREEN_RE.test(title)
}

function effectiveDurationMs(log: ActivityLogRow, weekStart: number, weekEnd: number): number {
  const start = Math.max(log.started_at, weekStart)
  const end = Math.min(log.ended_at, weekEnd)
  return Math.max(0, end - start)
}

function buildCategoryStatsText(logs: ActivityLogRow[], weekStart: number, weekEnd: number): string {
  const totals = new Map<ActivityCategory, number>()
  for (const log of logs) {
    if (isNoiseLog(log)) continue
    const cat = (log.category ?? 'other') as ActivityCategory
    const ms = effectiveDurationMs(log, weekStart, weekEnd)
    if (ms <= 0) continue
    totals.set(cat, (totals.get(cat) ?? 0) + ms)
  }
  const totalMs = [...totals.values()].reduce((a, b) => a + b, 0) || 1
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, ms]) => {
      const pct = Math.round((ms / totalMs) * 100)
      return `- ${CATEGORY_LABELS[cat]}：${formatDurationMinutes(ms)}（${pct}%）`
    })
    .join('\n') || '（无有效活动）'
}

function buildProjectStats(
  logs: ActivityLogRow[],
  weekStart: number,
  weekEnd: number
): ProjectWeekStat[] {
  type Bucket = { codeMs: number; totalMs: number; byCat: Map<ActivityCategory, number> }
  const byProject = new Map<string, Bucket>()

  for (const log of logs) {
    if (isNoiseLog(log)) continue
    const ms = effectiveDurationMs(log, weekStart, weekEnd)
    if (ms <= 0) continue
    const pk = log.parsed_project?.trim() || '未标注项目'
    if (!byProject.has(pk)) {
      byProject.set(pk, { codeMs: 0, totalMs: 0, byCat: new Map() })
    }
    const b = byProject.get(pk)!
    b.totalMs += ms
    const cat = (log.category ?? 'other') as ActivityCategory
    b.byCat.set(cat, (b.byCat.get(cat) ?? 0) + ms)
    if (cat === 'code_editor') b.codeMs += ms
  }

  return [...byProject.entries()]
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(([project, b]) => ({
      project,
      codeMs: b.codeMs,
      totalMs: b.totalMs,
      topCategories: [...b.byCat.entries()]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([cat]) => CATEGORY_LABELS[cat])
    }))
}

function detectAnomalies(
  logs: ActivityLogRow[],
  weekStart: number,
  weekEnd: number
): string[] {
  const anomalies: string[] = []
  for (const log of logs) {
    const ms = effectiveDurationMs(log, weekStart, weekEnd)
    if (ms <= 0) continue
    if (isNoiseLog(log) && ms >= 30 * 60 * 1000) {
      anomalies.push(
        `- ${formatReportTime(Math.max(log.started_at, weekStart))}–${formatReportTime(Math.min(log.ended_at, weekEnd))} 疑似锁屏/空闲（${formatDurationMinutes(ms)}）`
      )
      continue
    }
    const cat = (log.category ?? 'other') as ActivityCategory
    if (cat === 'other' && ms >= LONG_OTHER_MS) {
      const hint = log.sanitized_title || log.process_name || '未知窗口'
      anomalies.push(
        `- ${formatReportTime(Math.max(log.started_at, weekStart))}–${formatReportTime(Math.min(log.ended_at, weekEnd))} 未分类长时段：${hint.slice(0, 40)}（${formatDurationMinutes(ms)}）`
      )
    }
  }
  return anomalies.slice(0, 12)
}

async function buildGitEvidence(
  projects: string[],
  sinceMs: number
): Promise<GitWeekEvidence[]> {
  const gitMap = await collectGitCommitsForProjects(projects, sinceMs)
  const diffMap = loadAllGitDiffSnapshots(sinceMs)
  const out: GitWeekEvidence[] = []

  const allProjects = new Set([...projects, ...diffMap.keys(), ...gitMap.keys()])
  for (const project of allProjects) {
    const commits = gitMap.get(project)?.map(c => c.message) ?? []
    const diffs = diffMap.get(project) ?? []
    const files = new Set<string>()
    let insertions = 0
    let deletions = 0
    for (const d of diffs) {
      d.files.forEach(f => files.add(f))
      insertions += d.insertions
      deletions += d.deletions
    }
    if (commits.length === 0 && files.size === 0) continue
    out.push({
      project,
      commits,
      filesChanged: files.size,
      insertions,
      deletions
    })
  }

  return out.sort((a, b) => b.commits.length - a.commits.length)
}

export async function buildWeeklyEvidence(weekStartMs: number): Promise<WeeklyEvidence> {
  const { start, end } = weekBoundsFromStart(weekStartMs)
  const { items, total } = listActivityLogsOverlapping(start, end, 5000)
  const projectStats = buildProjectStats(items, start, end)
  const projects = projectStats.map(p => p.project).filter(p => p !== '未标注项目')
  const gitByProject = await buildGitEvidence(projects, start)

  return {
    projectStats,
    gitByProject,
    categoryStatsText: buildCategoryStatsText(items, start, end),
    anomalies: detectAnomalies(items, start, end),
    activityLogCount: total,
    activityLogTruncated: total > items.length
  }
}

export function formatProjectStatsForPrompt(stats: ProjectWeekStat[]): string {
  if (stats.length === 0) return '（本周无有效项目活动）'
  return stats
    .map(
      s =>
        `- **${s.project}**：编码 ${formatDurationMinutes(s.codeMs)}，总活跃 ${formatDurationMinutes(s.totalMs)}；主要类型：${s.topCategories.join('、') || '—'}`
    )
    .join('\n')
}

export function formatGitEvidenceForPrompt(git: GitWeekEvidence[]): string {
  if (git.length === 0) return '（本周无 Git 记录）'
  return git
    .map(g => {
      const commitLine =
        g.commits.length > 0
          ? g.commits.slice(0, 8).join('；') + (g.commits.length > 8 ? '…' : '')
          : '（无 commit）'
      const statLine =
        g.filesChanged > 0
          ? `${g.filesChanged} 文件，+${g.insertions}/-${g.deletions} 行`
          : '（无 diff 快照）'
      return `- **${g.project}**：${statLine}\n  提交：${commitLine}`
    })
    .join('\n')
}

export function formatWeekRangeLabel(weekStartMs: number): string {
  const { start, end } = weekBoundsFromStart(weekStartMs)
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}
