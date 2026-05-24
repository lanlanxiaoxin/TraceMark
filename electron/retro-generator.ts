import { getDb } from './database'
import { callChatCompletion, listReportsInRange, type StoredReportRow } from './ai-gateway'
import type { WorkAsset } from './work-assets'
import { getProjectSpace, listProjectSpaces } from './project-spaces'
import type { RetroType } from './retrospectives'
import { resolveProjectDisplayName, sanitizeTextForCloud } from './sanitizer'
import {
  formatAssetForCloudPreview,
  listConfirmedAssetsForRetro
} from './upload-preview'
import { canUseCloudAi } from './privacy-capabilities'
import { weekBoundsFromStart, currentWeekStartMs } from './date-bounds'
import { getReportLocale, loadLocalizedPrompt, reportSystemPrompt, type ReportLocale } from './report-prompts'
import { normalizeMarkdownContent } from '../shared/markdown-normalize'
import { buildStructuredOfflineRetroBody } from './retro-offline-body'

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

const OFFLINE_RETRO: Record<
  ReportLocale,
  {
    unassigned: string
    weeklyTitle: string
    phaseTitle: string
    phaseTitleNamed: string
    weeklyTitleNamed: string
    noPeriodReports: string
    offlineNote: string
    dateRange: string
    periodReportsFootnote: string
  }
> = {
  zh: {
    unassigned: '未归类',
    weeklyTitle: '周复盘',
    phaseTitle: '项目阶段复盘',
    phaseTitleNamed: '{{name}} 阶段复盘',
    weeklyTitleNamed: '{{name}} 周复盘',
    noPeriodReports: '（同期未保存日报/周报）',
    offlineNote: '离线模板：基于已确认工作资产整理，未调用 AI。可在下方切换「编辑」微调后保存。',
    dateRange: '时间范围',
    periodReportsFootnote: '（仅引用，不替代结论；勾选后重新生成可送入 AI）'
  },
  en: {
    unassigned: 'Unassigned',
    weeklyTitle: 'Weekly retrospective',
    phaseTitle: 'Project phase retrospective',
    phaseTitleNamed: '{{name}} — phase retrospective',
    weeklyTitleNamed: '{{name}} — weekly retrospective',
    noPeriodReports: '(No saved daily/weekly reports in this period)',
    offlineNote:
      'Offline template from confirmed assets; AI not used. Use Edit below to tweak before saving.',
    dateRange: 'Date range',
    periodReportsFootnote: '(Reference only; select reports and regenerate to include in AI)'
  }
}

function readSetting(key: string, fallback: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

function formatDateRange(start: number, end: number, locale: ReportLocale): string {
  const tag = locale === 'en' ? 'en-US' : 'zh-CN'
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(tag, { year: 'numeric', month: 'short', day: 'numeric' })
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

function formatReportShortLabel(report: StoredReportRow, locale: ReportLocale): string {
  const tag = locale === 'en' ? 'en-US' : 'zh-CN'
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(tag, { month: '2-digit', day: '2-digit' })
  const created = new Date(report.created_at).toLocaleDateString(tag, {
    month: '2-digit',
    day: '2-digit'
  })
  const kind = report.type === 'daily' ? (locale === 'en' ? 'Daily' : '日报') : locale === 'en' ? 'Weekly' : '周报'
  if (locale === 'en') {
    if (report.type === 'daily') {
      return `${fmt(report.date_start)} ${kind} (saved ${created})`
    }
    return `${fmt(report.date_start)}–${fmt(report.date_end)} ${kind} (saved ${created})`
  }
  if (report.type === 'daily') {
    return `${fmt(report.date_start)} ${kind}（保存于 ${created}）`
  }
  return `${fmt(report.date_start)}–${fmt(report.date_end)} ${kind}（保存于 ${created}）`
}

function buildPeriodReportsBlock(
  reports: StoredReportRow[],
  included: StoredReportRow[],
  locale: ReportLocale
): string {
  const emptyAll =
    locale === 'en'
      ? '(No saved daily / weekly reports in this period)'
      : '（同期未保存任何日报 / 周报）'
  const noneSelected =
    locale === 'en'
      ? '(No period reports selected; listed below for reference only)'
      : '（用户未选中任何同期报告，下列报告仅作引用，不进入正文）'
  const emptyContent = locale === 'en' ? '(Report body empty)' : '（报告内容为空）'

  if (reports.length === 0) return emptyAll
  if (included.length === 0) {
    return [noneSelected, ...reports.map(r => `- ${formatReportShortLabel(r, locale)}`)].join('\n')
  }
  return included
    .map(r => {
      const safe = sanitizeTextForCloud(r.content).slice(0, 1600)
      return `### ${formatReportShortLabel(r, locale)}\n${safe || emptyContent}`
    })
    .join('\n\n')
}

function buildRetroTitle(
  type: RetroType,
  projectDisplayName: string | undefined,
  locale: ReportLocale
): string {
  const L = OFFLINE_RETRO[locale]
  if (type === 'weekly') {
    return projectDisplayName
      ? L.weeklyTitleNamed.replace('{{name}}', projectDisplayName)
      : L.weeklyTitle
  }
  return projectDisplayName
    ? L.phaseTitleNamed.replace('{{name}}', projectDisplayName)
    : L.phaseTitle
}

function buildOfflineRetro(
  type: RetroType,
  title: string,
  dateStart: number,
  dateEnd: number,
  assets: WorkAsset[],
  displayById: Map<number, string>,
  periodReports: StoredReportRow[],
  locale: ReportLocale
): string {
  const L = OFFLINE_RETRO[locale]
  const projectLabel = (projectId: number | null): string => {
    if (projectId == null) return L.unassigned
    return displayById.get(projectId) ?? L.unassigned
  }

  const reportRefs =
    periodReports.length === 0
      ? L.noPeriodReports
      : `${L.periodReportsFootnote}\n\n${periodReports.map(r => `- ${formatReportShortLabel(r, locale)}`).join('\n')}`

  const body = buildStructuredOfflineRetroBody(
    type,
    assets,
    projectLabel,
    reportRefs,
    locale
  )

  const raw = `## ${title}

> **${L.dateRange}：** ${formatDateRange(dateStart, dateEnd, locale)}  
> ${L.offlineNote}

${body}
`
  return normalizeMarkdownContent(raw)
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
  const locale = getReportLocale()
  const promptFile =
    type === 'weekly' ? 'weekly-retro-v1.md' : 'project-phase-retro-v1.md'
  const template = loadLocalizedPrompt(promptFile)
  const emptyAssets =
    locale === 'en'
      ? '(No confirmed outcome or process assets in this period)'
      : '（该时段无已确认的成果或过程资产）'
  const assetsText =
    assets.length > 0
      ? assets.map((a, i) => formatAssetBlock(a, displayById, i + 1)).join('\n\n')
      : emptyAssets
  const reportsText = buildPeriodReportsBlock(periodReports, includedReports, locale)
  const allProjectsLabel = locale === 'en' ? 'All projects' : '全部项目'

  const prompt = template
    .replace('{{date_range}}', formatDateRange(dateStart, dateEnd, locale))
    .replace('{{project_name}}', projectDisplayName ?? allProjectsLabel)
    .replace('{{confirmed_assets}}', assetsText)
    .replace('{{asset_count}}', String(assets.length))
    .replace('{{period_reports}}', reportsText)

  const systemKind = type === 'weekly' ? 'weeklyRetro' : 'projectPhaseRetro'
  const raw = await callChatCompletion(prompt, reportSystemPrompt(systemKind))
  return normalizeMarkdownContent(raw)
}

async function generateRetro(
  type: RetroType,
  projectId: number | null | undefined,
  dateStart: number,
  dateEnd: number,
  extra?: RetroExtraOptions
): Promise<GenerateRetroResult> {
  const locale = getReportLocale()
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

  const title = buildRetroTitle(type, projectDisplayName, locale)

  const useOffline =
    readSetting('offline_mode', 'false') === 'true' ||
    !readSetting('api_key', '').trim() ||
    !canUseCloudAi()

  if (useOffline) {
    return {
      content: buildOfflineRetro(
        type,
        title,
        dateStart,
        dateEnd,
        assets,
        displayById,
        periodReports,
        locale
      ),
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
      content: buildOfflineRetro(
        type,
        title,
        dateStart,
        dateEnd,
        assets,
        displayById,
        periodReports,
        locale
      ),
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
