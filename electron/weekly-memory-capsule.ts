import { weekBoundsFromStart } from './date-bounds'
import { listDailySealsBetween } from './daily-seal'
import { formatWeekRangeLabel, buildWeeklyEvidence } from './report-evidence'
import { listWorkAssets, type WorkAsset } from './work-assets'
import { getProjectSpace } from './project-spaces'

export interface WeeklyMemoryCapsuleSection {
  title: string
  items: string[]
}

export interface WeeklyMemoryCapsulePayload {
  weekLabel: string
  weekStartMs: number
  stats: {
    assetCount: number
    sealCount: number
    outcomeCount: number
  }
  statsSubtitle: string
  sections: WeeklyMemoryCapsuleSection[]
}

function assetLine(a: WorkAsset): string {
  const proj = a.projectId != null ? getProjectSpace(a.projectId)?.name : null
  const prefix = proj ? `[${proj}] ` : ''
  const impact = a.impact?.trim() ? ` — ${a.impact.trim().slice(0, 40)}` : ''
  return `${prefix}${a.title}${impact}`.slice(0, 72)
}

export async function buildWeeklyMemoryCapsule(
  weekStartMs: number
): Promise<WeeklyMemoryCapsulePayload> {
  const { start, end } = weekBoundsFromStart(weekStartMs)
  const assets = listWorkAssets({
    status: ['confirmed', 'private'],
    dateStart: start,
    dateEnd: end,
    limit: 200
  })
  const seals = listDailySealsBetween(start, end)
  const outcomes = assets.filter(a => a.assetKind === 'outcome')
  const processes = assets.filter(a => a.assetKind === 'process')
  const highValue = assets.filter(
    a => a.assetKind === 'outcome' && (a.confidence === 'high' || (a.impact?.trim().length ?? 0) > 0)
  )

  const evidence = await buildWeeklyEvidence(weekStartMs)
  const categoryLine = evidence.categoryStatsText
    ? evidence.categoryStatsText.split('\n')[0]?.replace(/^[-*]\s*/, '') ?? ''
    : ''

  const sealNotes = seals
    .filter(s => s.note.trim().length > 0)
    .map(
      s =>
        `${new Date(s.dateMs).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}：${s.note.trim().slice(0, 48)}`
    )
    .slice(0, 3)

  const sections: WeeklyMemoryCapsuleSection[] = [
    {
      title: '本周成果',
      items:
        outcomes.length > 0
          ? outcomes.slice(0, 5).map(assetLine)
          : ['（暂无成果卡，多在「今日」确认候选资产）']
    },
    {
      title: '本周突破',
      items:
        (highValue.length > 0 ? highValue : outcomes).slice(0, 4).map(assetLine).length > 0
          ? (highValue.length > 0 ? highValue : outcomes).slice(0, 4).map(assetLine)
          : sealNotes.length > 0
            ? sealNotes
            : ['（从盖章一句话或 Git 活动提炼）']
    },
    {
      title: '卡点 · 下周',
      items:
        processes.length > 0
          ? processes.slice(0, 4).map(assetLine)
          : ['（回顾时间轴或 Ctrl+K 回忆具体事项）']
    }
  ]

  const statsSubtitle = [
    `盖章 ${seals.length}/7 天`,
    categoryLine || null,
    evidence.gitByProject.length > 0 ? `Git · ${evidence.gitByProject.length} 个项目有提交` : null
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    weekLabel: formatWeekRangeLabel(weekStartMs),
    weekStartMs,
    stats: {
      assetCount: assets.length,
      sealCount: seals.length,
      outcomeCount: outcomes.length
    },
    statsSubtitle: statsSubtitle || '基于已确认资产与今日盖章',
    sections
  }
}
