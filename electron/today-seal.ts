import { listActivityLogs } from './activity-logs'
import { dayBounds } from './work-asset-generator'
import { listWorkAssets } from './work-assets'
import { getProjectSpace, matchProjectId, listProjectSpaces } from './project-spaces'

export interface TodayMainlineSuggestion {
  projectId: number | null
  projectName: string | null
  parsedProjectLabel: string | null
  taskHint: string | null
  activityMinutes: number
  confidence: 'high' | 'low'
}

/** 根据当日活动与候选资产，启发式推荐今日主线项目/任务（无 AI）。 */
export function suggestTodayMainline(dateMs: number): TodayMainlineSuggestion {
  const { start, end } = dayBounds(dateMs)
  const { items: logs } = listActivityLogs({ startTime: start, endTime: end, limit: 5000 })

  const byProjectId = new Map<number, number>()
  const byParsed = new Map<string, number>()

  for (const log of logs) {
    const ms = Math.max(0, log.ended_at - log.started_at)
    const pid = matchProjectId(log.parsed_project, log.window_title, log.sanitized_title, {
      parsedFile: log.parsed_file,
      processName: log.process_name,
      category: log.category
    })
    if (pid != null) {
      byProjectId.set(pid, (byProjectId.get(pid) ?? 0) + ms)
    }
    const parsed = log.parsed_project?.trim()
    if (parsed) {
      byParsed.set(parsed, (byParsed.get(parsed) ?? 0) + ms)
    }
  }

  let projectId: number | null = null
  let activityMs = 0
  if (byProjectId.size > 0) {
    const top = [...byProjectId.entries()].sort((a, b) => b[1] - a[1])[0]
    projectId = top[0]
    activityMs = top[1]
  }

  let parsedProjectLabel: string | null = null
  if (byParsed.size > 0) {
    const topParsed = [...byParsed.entries()].sort((a, b) => b[1] - a[1])[0]
    parsedProjectLabel = topParsed[0]
    if (projectId == null) activityMs = topParsed[1]
  }

  const spaces = listProjectSpaces()
  let projectName: string | null = null
  if (projectId != null) {
    projectName = getProjectSpace(projectId)?.name ?? null
  } else if (parsedProjectLabel && spaces.length > 0) {
    const norm = parsedProjectLabel.toLowerCase()
    const hit = spaces.find(
      s => s.name.toLowerCase() === norm || (s.privacyAlias?.trim().toLowerCase() === norm)
    )
    if (hit) {
      projectId = hit.id
      projectName = hit.name
    }
  }

  const assets = listWorkAssets({ dateStart: start, dateEnd: end, limit: 200 })
  const activeAssets = assets.filter(a => a.status === 'suggested' || a.status === 'confirmed')
  let taskHint: string | null = null
  if (activeAssets.length > 0) {
    const scoped =
      projectId != null
        ? activeAssets.filter(a => a.projectId === projectId)
        : activeAssets
    const pick = (scoped.length > 0 ? scoped : activeAssets).sort((a, b) => {
      const aEnd = a.evidence.reduce((m, e) => Math.max(m, e.endedAt ?? 0), 0)
      const bEnd = b.evidence.reduce((m, e) => Math.max(m, e.endedAt ?? 0), 0)
      return bEnd - aEnd
    })[0]
    taskHint = pick?.title ?? null
  }

  const activityMinutes = Math.round(activityMs / 60000)
  const confidence: 'high' | 'low' =
    activityMinutes >= 30 || (projectId != null && activityMinutes >= 10) ? 'high' : 'low'

  return {
    projectId,
    projectName,
    parsedProjectLabel,
    taskHint,
    activityMinutes,
    confidence
  }
}
