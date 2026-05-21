import { getDb } from './database'
import { callChatCompletion, listReportsInRange, type StoredReportRow } from './ai-gateway'
import type { WorkAsset } from './work-assets'
import { getProjectSpace, listProjectSpaces } from './project-spaces'
import type { RetroType } from './retrospectives'
import { loadPromptFile } from './prompt-path'
import { resolveProjectDisplayName, sanitizeTextForCloud } from './sanitizer'
import {
  formatAssetForCloudPreview,
  listConfirmedAssetsForRetro
} from './upload-preview'
import { canUseCloudAi } from './privacy-capabilities'
import { weekBoundsFromStart, currentWeekStartMs } from './date-bounds'

export { weekBoundsFromStart, currentWeekStartMs }

export interface GenerateRetroResult {
  content: string
  mode: 'ai' | 'offline'
  sourceAssetIds: number[]
  sourceReportIds: number[]
  degradedFromAi?: boolean
  degradationReason?: string
}

export interface RetroExtraOptions {
  /** 用户主动选中的「同期报告」id，若为空则只列名不送入 prompt。 */
  includeReportIds?: number[]
}

function readSetting(key: string, fallback: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

function formatDateRange(start: number, end: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function buildDisplayNameMap(): Map<number, string> {
  const spaces = listProjectSpaces()
  return new Map(
    spaces.map(s => [s.id, resolveProjectDisplayName(s.name, s.privacyAlias)])
  )
}

function formatAssetBlock(asset: WorkAsset, displayById: Map<number, string>, index: number): string {
  const lines = formatAssetForCloudPreview(asset, displayById)
  return `### ${index}. ${sanitizeTextForCloud(asset.title)}\n${lines.join('\n')}`
}

function formatReportShortLabel(report: StoredReportRow): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  const created = new Date(report.created_at).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  })
  const kind = report.type === 'daily' ? '日报' : '周报'
  if (report.type === 'daily') {
    return `${fmt(report.date_start)} ${kind}（保存于 ${created}）`
  }
  return `${fmt(report.date_start)}–${fmt(report.date_end)} ${kind}（保存于 ${created}）`
}

function buildPeriodReportsBlock(
  reports: StoredReportRow[],
  included: StoredReportRow[]
): string {
  if (reports.length === 0) return '（同期未保存任何日报 / 周报）'
  if (included.length === 0) {
    return [
      '（用户未选中任何同期报告，下列报告仅作引用，不进入正文）',
      ...reports.map(r => `- ${formatReportShortLabel(r)}`)
    ].join('\n')
  }
  return included
    .map(r => {
      const safe = sanitizeTextForCloud(r.content).slice(0, 1600)
      return `### ${formatReportShortLabel(r)}\n${safe || '（报告内容为空）'}`
    })
    .join('\n\n')
}

function buildOfflineRetro(
  title: string,
  dateStart: number,
  dateEnd: number,
  assets: WorkAsset[],
  displayById: Map<number, string>,
  periodReports: StoredReportRow[]
): string {
  const projectLabel = (projectId: number | null): string => {
    if (projectId == null) return '未归类'
    return displayById.get(projectId) ?? '未归类'
  }

  const byProject = new Map<string, WorkAsset[]>()
  for (const asset of assets) {
    const key = projectLabel(asset.projectId)
    const list = byProject.get(key) ?? []
    list.push(asset)
    byProject.set(key, list)
  }

  const sections = [...byProject.entries()].map(([proj, items]) => {
    const lines = items.map(a => `- ${sanitizeTextForCloud(a.title)}`)
    return `### ${proj}\n${lines.join('\n')}`
  })

  const reportRefs =
    periodReports.length === 0
      ? '（同期未保存日报/周报）'
      : periodReports.map(r => `- ${formatReportShortLabel(r)}`).join('\n')

  return `## ${title}

> 时间范围：${formatDateRange(dateStart, dateEnd)}  
> 离线模式：基于已确认工作资产生成，未调用 AI。

### 本周/阶段要点
${assets.length === 0 ? '（该时段无已确认的成果或过程资产）' : sections.join('\n\n')}

### 引用资产
共 ${assets.length} 条已确认资产（成果 + 过程）。

### 同期报告（仅引用，不替代结论）
${reportRefs}
`
}

async function generateWithAi(
  type: RetroType,
  dateStart: number,
  dateEnd: number,
  assets: WorkAsset[],
  displayById: Map<number, string>,
  periodReports: StoredReportRow[],
  includedReports: StoredReportRow[],
  projectDisplayName?: string
): Promise<string> {
  const promptFile =
    type === 'weekly' ? 'weekly-retro-v1.md' : 'project-phase-retro-v1.md'
  const template = loadPromptFile(promptFile)
  const assetsText =
    assets.length > 0
      ? assets.map((a, i) => formatAssetBlock(a, displayById, i + 1)).join('\n\n')
      : '（该时段无已确认的成果或过程资产）'
  const reportsText = buildPeriodReportsBlock(periodReports, includedReports)

  const prompt = template
    .replace('{{date_range}}', formatDateRange(dateStart, dateEnd))
    .replace('{{project_name}}', projectDisplayName ?? '全部项目')
    .replace('{{confirmed_assets}}', assetsText)
    .replace('{{asset_count}}', String(assets.length))
    .replace('{{period_reports}}', reportsText)

  const system =
    type === 'weekly'
      ? '你是个人工作复盘助手。仅根据用户已确认的工作资产生成周复盘，不要编造未列出的交付。输出中文 Markdown。'
      : '你是个人项目复盘助手。仅根据用户已确认的工作资产生成项目阶段复盘，突出成果、决策与待跟进。输出中文 Markdown。'

  return callChatCompletion(prompt, system)
}

async function generateRetro(
  type: RetroType,
  projectId: number | null | undefined,
  dateStart: number,
  dateEnd: number,
  extra?: RetroExtraOptions
): Promise<GenerateRetroResult> {
  const displayById = buildDisplayNameMap()
  const assets = listConfirmedAssetsForRetro(projectId ?? undefined, dateStart, dateEnd)
  const sourceAssetIds = assets.map(a => a.id)

  const periodReports = listReportsInRange({
    dateStart,
    dateEnd,
    types: ['daily', 'weekly'],
    limit: 40
  })
  const includeIds = new Set(extra?.includeReportIds ?? [])
  const includedReports = periodReports.filter(r => includeIds.has(r.id))
  const sourceReportIds = includedReports.map(r => r.id)

  const space = projectId != null ? getProjectSpace(projectId) : null
  const projectDisplayName = space
    ? resolveProjectDisplayName(space.name, space.privacyAlias)
    : undefined

  const title =
    type === 'weekly'
      ? projectDisplayName
        ? `${projectDisplayName} 周复盘`
        : '周复盘'
      : projectDisplayName
        ? `${projectDisplayName} 阶段复盘`
        : '项目阶段复盘'

  const useOffline =
    readSetting('offline_mode', 'false') === 'true' ||
    !readSetting('api_key', '').trim() ||
    !canUseCloudAi()

  if (useOffline) {
    return {
      content: buildOfflineRetro(title, dateStart, dateEnd, assets, displayById, periodReports),
      mode: 'offline',
      sourceAssetIds,
      sourceReportIds
    }
  }

  try {
    const content = await generateWithAi(
      type,
      dateStart,
      dateEnd,
      assets,
      displayById,
      periodReports,
      includedReports,
      projectDisplayName
    )
    return { content, mode: 'ai', sourceAssetIds, sourceReportIds }
  } catch (err) {
    return {
      content: buildOfflineRetro(title, dateStart, dateEnd, assets, displayById, periodReports),
      mode: 'offline',
      sourceAssetIds,
      sourceReportIds,
      degradedFromAi: true,
      degradationReason: err instanceof Error ? err.message : 'AI 请求失败'
    }
  }
}

export async function generateWeeklyRetro(
  projectId: number | null,
  weekStartMs: number,
  extra?: RetroExtraOptions
): Promise<GenerateRetroResult> {
  const { start, end } = weekBoundsFromStart(weekStartMs)
  return generateRetro('weekly', projectId, start, end, extra)
}

export async function generateProjectPhaseRetro(
  projectId: number,
  dateStart: number,
  dateEnd: number,
  extra?: RetroExtraOptions
): Promise<GenerateRetroResult> {
  return generateRetro('project_phase', projectId, dateStart, dateEnd, extra)
}
