import type { ActivityRecallHit, TimelineIntent, WorkAsset } from '@/env'
import { startOfDay } from '@/lib/activityLogs'

export interface TimelineFocus {
  highlightActivityLogId?: number
  focusStartedAt?: number
}

/** 从工作资产推导时间轴定位 intent（G3）。 */
export function timelineIntentFromAsset(asset: WorkAsset): TimelineIntent {
  const evidenceWithLog = asset.evidence.find(e => e.activityLogId != null)
  const evidenceTime = asset.evidence.find(e => e.startedAt != null)

  const anchorMs =
    asset.startedAt ?? evidenceWithLog?.startedAt ?? evidenceTime?.startedAt ?? asset.createdAt

  return {
    dayTimestamp: startOfDay(anchorMs),
    highlightActivityLogId: evidenceWithLog?.activityLogId,
    focusStartedAt:
      evidenceWithLog?.startedAt ?? asset.startedAt ?? evidenceTime?.startedAt ?? undefined
  }
}

export function timelineIntentFromActivity(hit: ActivityRecallHit): TimelineIntent {
  return {
    dayTimestamp: startOfDay(hit.startedAt),
    highlightActivityLogId: hit.id,
    focusStartedAt: hit.startedAt
  }
}

function containsTime(log: { started_at: number; ended_at: number }, ms: number): boolean {
  return log.started_at <= ms && log.ended_at >= ms
}

type ActivityLogLike = {
  id: number
  started_at: number
  ended_at: number
}

/** 在已加载的活动列表中解析应高亮的单条记录 id。 */
export function resolveHighlightLogId(
  logs: ActivityLogLike[],
  focus: TimelineFocus
): number | null {
  if (focus.highlightActivityLogId != null) {
    const byId = logs.find(l => l.id === focus.highlightActivityLogId)
    if (byId) return byId.id
  }

  const anchorMs = focus.focusStartedAt
  if (anchorMs != null && logs.length > 0) {
    const containing = logs.find(l => containsTime(l, anchorMs))
    if (containing) return containing.id

    let best = logs[0]
    let bestDist = Math.min(Math.abs(best.started_at - anchorMs), Math.abs(best.ended_at - anchorMs))
    for (const log of logs) {
      const dist = Math.min(Math.abs(log.started_at - anchorMs), Math.abs(log.ended_at - anchorMs))
      if (dist < bestDist) {
        bestDist = dist
        best = log
      }
    }
    return best.id
  }

  if (focus.highlightActivityLogId != null) return focus.highlightActivityLogId
  return null
}

export function hasTimelineFocus(focus: TimelineFocus): boolean {
  return focus.highlightActivityLogId != null || focus.focusStartedAt != null
}

/** 是否已具备可靠高亮目标（避免分页未加载完时误标最近一条）。 */
export function isHighlightResolved(
  logs: ActivityLogLike[],
  focus: TimelineFocus,
  hasMore: boolean
): boolean {
  if (focus.highlightActivityLogId != null) {
    return logs.some(l => l.id === focus.highlightActivityLogId)
  }
  if (focus.focusStartedAt != null) {
    if (logs.some(l => containsTime(l, focus.focusStartedAt!))) return true
    return logs.length > 0 && !hasMore
  }
  return false
}
