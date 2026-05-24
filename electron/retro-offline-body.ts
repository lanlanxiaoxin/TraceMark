import type { WorkAsset } from './work-assets'
import type { StoredReportRow } from './ai-gateway'
import type { RetroType } from './retrospectives'
import { sanitizeTextForCloud } from './sanitizer'
import type { ReportLocale } from './report-prompts'

const TITLE_MAX = 96
const EXTRA_MAX = 140

function truncateText(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function normalizeTitleKey(title: string): string {
  return sanitizeTextForCloud(title).trim().toLowerCase()
}

/** 离线复盘：合并重复标题，优先保留有 impact/description 的条目。 */
export function dedupeRetroAssets(assets: WorkAsset[]): WorkAsset[] {
  const byKey = new Map<string, WorkAsset>()
  for (const asset of assets) {
    const key = normalizeTitleKey(asset.title)
    if (!key) continue
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, asset)
      continue
    }
    const score = (a: WorkAsset) =>
      (a.impact?.trim() ? 4 : 0) +
      (a.description?.trim() ? 2 : 0) +
      (a.confidence === 'high' ? 1 : 0)
    if (score(asset) > score(prev)) byKey.set(key, asset)
  }
  return [...byKey.values()]
}

function formatAssetBullet(asset: WorkAsset): string {
  const title = truncateText(sanitizeTextForCloud(asset.title), TITLE_MAX)
  const impact = asset.impact?.trim()
    ? truncateText(sanitizeTextForCloud(asset.impact), EXTRA_MAX)
    : ''
  const desc = !impact && asset.description?.trim()
    ? truncateText(sanitizeTextForCloud(asset.description), EXTRA_MAX)
    : ''
  const extra = impact ? ` — ${impact}` : desc ? `（${desc}）` : ''
  return `- **${title}**${extra}`
}

function groupAssetsByProject(
  assets: WorkAsset[],
  projectLabel: (projectId: number | null) => string
): Map<string, WorkAsset[]> {
  const map = new Map<string, WorkAsset[]>()
  for (const asset of assets) {
    const key = projectLabel(asset.projectId)
    const list = map.get(key) ?? []
    list.push(asset)
    map.set(key, list)
  }
  return map
}

function renderProjectGroupedSection(
  assets: WorkAsset[],
  projectLabel: (projectId: number | null) => string,
  emptyLine: string
): string {
  if (assets.length === 0) return emptyLine
  const byProject = groupAssetsByProject(assets, projectLabel)
  const sorted = [...byProject.entries()].sort((a, b) => b[1].length - a[1].length)
  return sorted
    .map(([proj, items]) => {
      const bullets = items.map(formatAssetBullet).join('\n')
      return sorted.length > 1 ? `### ${proj}\n${bullets}` : bullets
    })
    .join('\n\n')
}

const SECTIONS: Record<
  ReportLocale,
  {
    weekly: {
      overview: string
      outcomes: string
      inProgress: string
      risks: string
      nextWeek: string
      refAssets: string
      periodReports: string
    }
    phase: {
      goals: string
      delivered: string
      decisions: string
      open: string
      next: string
      refAssets: string
      periodReports: string
    }
    kindOutcome: string
    kindProcess: string
    kindEvidence: string
    noneOutcomes: string
    noneProcess: string
    noneRisks: string
    nextPlaceholder: string
    overviewStats: string
    overviewProjects: string
  }
> = {
  zh: {
    weekly: {
      overview: '本周概览',
      outcomes: '主要成果',
      inProgress: '进行中事项',
      risks: '问题与风险',
      nextWeek: '下周计划',
      refAssets: '引用资产',
      periodReports: '同期报告'
    },
    phase: {
      goals: '阶段目标回顾',
      delivered: '已完成交付',
      decisions: '关键过程与决策',
      open: '遗留与风险',
      next: '下阶段建议',
      refAssets: '引用资产',
      periodReports: '同期报告'
    },
    kindOutcome: '成果',
    kindProcess: '过程',
    kindEvidence: '证据',
    noneOutcomes: '（本周暂无成果类资产，可在「今日」确认更多成果卡）',
    noneProcess: '（暂无过程类资产）',
    noneRisks: '（暂无明确风险项）',
    nextPlaceholder:
      '- 根据本周过程卡与未闭环事项安排优先级\n- 建议在「今日」补充低置信度资产的一句话说明',
    overviewStats: '已确认资产 **{{total}}** 条（成果 **{{outcomes}}** · 过程 **{{process}}**）',
    overviewProjects: '涉及项目：{{projects}}'
  },
  en: {
    weekly: {
      overview: 'Week overview',
      outcomes: 'Key outcomes',
      inProgress: 'In progress',
      risks: 'Issues & risks',
      nextWeek: 'Next week',
      refAssets: 'Referenced assets',
      periodReports: 'Period reports'
    },
    phase: {
      goals: 'Phase goals review',
      delivered: 'Delivered outcomes',
      decisions: 'Key process & decisions',
      open: 'Open items & risks',
      next: 'Next phase',
      refAssets: 'Referenced assets',
      periodReports: 'Period reports'
    },
    kindOutcome: 'Outcome',
    kindProcess: 'Process',
    kindEvidence: 'Evidence',
    noneOutcomes: '(No outcome assets this period—confirm more in Today)',
    noneProcess: '(No process assets)',
    noneRisks: '(No explicit risks flagged)',
    nextPlaceholder:
      '- Prioritize open items from process cards\n- Add one-line notes for low-confidence assets in Today',
    overviewStats:
      '**{{total}}** confirmed assets (outcomes **{{outcomes}}** · process **{{process}}**)',
    overviewProjects: 'Projects: {{projects}}'
  }
}

export function buildStructuredOfflineRetroBody(
  type: RetroType,
  assets: WorkAsset[],
  projectLabel: (projectId: number | null) => string,
  periodReportLines: string,
  locale: ReportLocale
): string {
  const L = SECTIONS[locale]
  const unique = dedupeRetroAssets(assets)
  const outcomes = unique.filter(a => a.assetKind === 'outcome')
  const processes = unique.filter(a => a.assetKind === 'process')
  const evidence = unique.filter(a => a.assetKind === 'evidence')
  const lowConf = unique.filter(
    a => a.confidence === 'low' || a.confidence === 'medium'
  )

  const projectNames = [
    ...new Set(unique.map(a => projectLabel(a.projectId)))
  ].slice(0, 8)
  const overviewStats = L.overviewStats
    .replace('{{total}}', String(unique.length))
    .replace('{{outcomes}}', String(outcomes.length))
    .replace('{{process}}', String(processes.length))
  const overviewProjects = L.overviewProjects.replace(
    '{{projects}}',
    projectNames.length > 0 ? projectNames.join(locale === 'en' ? ', ' : '、') : '—'
  )

  const refLines = unique.map(a => {
    const kind =
      a.assetKind === 'outcome'
        ? L.kindOutcome
        : a.assetKind === 'process'
          ? L.kindProcess
          : L.kindEvidence
    const title = truncateText(sanitizeTextForCloud(a.title), TITLE_MAX)
    return `- [${kind}] ${title}`
  })

  const riskLines =
    lowConf.length > 0
      ? lowConf.map(a => {
          const title = truncateText(sanitizeTextForCloud(a.title), TITLE_MAX)
          const note = a.description?.trim()
            ? ` — ${truncateText(sanitizeTextForCloud(a.description), 80)}`
            : ''
          return `- **${title}**${note}`
        })
      : []

  if (type === 'weekly') {
    const S = L.weekly
    return [
      `## ${S.overview}`,
      `- ${overviewStats}`,
      `- ${overviewProjects}`,
      '',
      `## ${S.outcomes}`,
      renderProjectGroupedSection(outcomes, projectLabel, L.noneOutcomes),
      '',
      `## ${S.inProgress}`,
      renderProjectGroupedSection(processes, projectLabel, L.noneProcess),
      '',
      `## ${S.risks}`,
      riskLines.length > 0 ? riskLines.join('\n') : L.noneRisks,
      '',
      `## ${S.nextWeek}`,
      L.nextPlaceholder,
      '',
      `## ${S.refAssets}`,
      refLines.length > 0 ? refLines.join('\n') : L.noneOutcomes,
      evidence.length > 0
        ? `\n\n_${locale === 'en' ? 'Evidence-only cards' : '仅证据类'} (${evidence.length})_`
        : '',
      '',
      `## ${S.periodReports}`,
      periodReportLines
    ]
      .filter(Boolean)
      .join('\n')
  }

  const S = L.phase
  return [
    `## ${S.goals}`,
    `- ${overviewStats}`,
    `- ${overviewProjects}`,
    '',
    `## ${S.delivered}`,
    renderProjectGroupedSection(outcomes, projectLabel, L.noneOutcomes),
    '',
    `## ${S.decisions}`,
    renderProjectGroupedSection(processes, projectLabel, L.noneProcess),
    '',
    `## ${S.open}`,
    riskLines.length > 0 ? riskLines.join('\n') : L.noneRisks,
    '',
    `## ${S.next}`,
    L.nextPlaceholder,
    '',
    `## ${S.refAssets}`,
    refLines.length > 0 ? refLines.join('\n') : L.noneOutcomes,
    '',
    `## ${S.periodReports}`,
    periodReportLines
  ]
    .filter(Boolean)
    .join('\n')
}
