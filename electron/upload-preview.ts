import { getDb } from './database'
import { sanitizeTextForCloud, resolveProjectDisplayName } from './sanitizer'
import { listWorkAssets, type WorkAsset } from './work-assets'
import { getProjectSpace, listProjectSpaces } from './project-spaces'
import { canUseCloudAi, PRIVACY_CAPABILITIES, isCapabilityEnabled } from './privacy-capabilities'
import type { RetroType } from './retrospectives'
import { weekBoundsFromStart } from './date-bounds'
import { listActivityLogs } from './activity-logs'
import { CATEGORY_LABELS, type ActivityCategory } from './window-title-parser'
import { dayBounds } from './work-asset-generator'
import { buildDailyNarrativePlain, buildDailyNarrativePromptPayload } from './daily-narrative'
import { getDailySeal } from './daily-seal'
import {
  buildActivitySummaryForPrompt,
  buildAssetsSectionForPrompt,
  formatSealBlock
} from './daily-report-v3'
import { buildWeeklyContextPreviewSummary } from './weekly-report-builder'

export interface UploadPreviewLine {
  kind: 'info' | 'warning' | 'blocked'
  text: string
}

export interface UploadPreview {
  title: string
  lines: UploadPreviewLine[]
  payloadSummary: string
  canProceed: boolean
  requiresConsent: boolean
}

function readSetting(key: string, fallback: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

function hasApiKey(): boolean {
  return readSetting('api_key', '').trim().length > 0
}

function isOfflineMode(): boolean {
  return readSetting('offline_mode', 'false') === 'true'
}

export function checkCloudAiGate(): UploadPreview {
  const lines: UploadPreviewLine[] = []

  if (isOfflineMode()) {
    lines.push({ kind: 'info', text: '当前为离线模式，将使用本地模板生成，不上传云端。' })
    return {
      title: '生成方式',
      lines,
      payloadSummary: '',
      canProceed: true,
      requiresConsent: false
    }
  }

  if (!hasApiKey()) {
    lines.push({ kind: 'info', text: '未配置 API Key，将使用离线模板生成。' })
    return {
      title: '生成方式',
      lines,
      payloadSummary: '',
      canProceed: true,
      requiresConsent: false
    }
  }

  if (!canUseCloudAi()) {
    lines.push({
      kind: 'blocked',
      text: '未开启「L1 云端结构化」授权。请在设置中同意后再使用云端 AI，或继续使用离线生成。'
    })
    return {
      title: '需要授权',
      lines,
      payloadSummary: '',
      canProceed: true,
      requiresConsent: true
    }
  }

  return {
    title: '云端 AI 上传预览',
    lines: [{ kind: 'info', text: '以下内容将发送至配置的模型 API（已脱敏）。' }],
    payloadSummary: '',
    canProceed: true,
    requiresConsent: false
  }
}

function projectDisplayName(projectId: number | null, nameById: Map<number, string>): string {
  if (projectId == null) return '未归类'
  const space = getProjectSpace(projectId)
  if (space) {
    return resolveProjectDisplayName(space.name, space.privacyAlias)
  }
  return nameById.get(projectId) ?? `项目 #${projectId}`
}

export function formatAssetForCloudPreview(
  asset: WorkAsset,
  nameById: Map<number, string>
): string[] {
  const lines: string[] = []
  lines.push(`- 标题：${sanitizeTextForCloud(asset.title)}`)
  lines.push(`- 类型：${asset.assetKind}`)
  lines.push(`- 项目：${projectDisplayName(asset.projectId, nameById)}`)
  if (asset.description) {
    lines.push(`- 补充：${sanitizeTextForCloud(asset.description)}`)
  }
  if (asset.impact) {
    lines.push(`- 影响：${sanitizeTextForCloud(asset.impact)}`)
  }
  for (const e of asset.evidence.slice(0, 5)) {
    lines.push(`  - [${e.type}] ${sanitizeTextForCloud(e.summary)}`)
  }
  return lines
}

export function listConfirmedAssetsForRetro(
  projectId: number | null | undefined,
  dateStart: number,
  dateEnd: number
): WorkAsset[] {
  const filter: Parameters<typeof listWorkAssets>[0] = {
    status: 'confirmed',
    dateStart,
    dateEnd,
    limit: 500
  }
  if (projectId !== undefined) {
    filter.projectId = projectId
  }
  return listWorkAssets(filter).filter(
    a => a.assetKind === 'outcome' || a.assetKind === 'process'
  )
}

export function buildRetroUploadPreview(
  type: RetroType,
  projectId: number | null,
  dateStart: number,
  dateEnd: number
): UploadPreview {
  const gate = checkCloudAiGate()
  if (!gate.canProceed || gate.requiresConsent || gate.lines.some(l => l.kind === 'blocked')) {
    return gate
  }
  if (isOfflineMode() || !hasApiKey() || !canUseCloudAi()) {
    return gate
  }

  const spaces = listProjectSpaces()
  const nameById = new Map(spaces.map(s => [s.id, s.name]))
  const assets = listConfirmedAssetsForRetro(projectId ?? undefined, dateStart, dateEnd)

  const l2 = isCapabilityEnabled('global', null, PRIVACY_CAPABILITIES.L2_ENHANCED)
  const l3 =
    projectId != null &&
    isCapabilityEnabled('project', String(projectId), PRIVACY_CAPABILITIES.L3_PROJECT_DIR)

  const lines: UploadPreviewLine[] = [...gate.lines]
  if (l2) {
    lines.push({
      kind: 'info',
      text: 'L2 已开启：复盘上下文可含资产证据中的 Git/会议/文档片段摘要（已脱敏）。'
    })
  }
  if (projectId != null) {
    lines.push({
      kind: l3 ? 'info' : 'warning',
      text: l3
        ? 'L3 已开启：该项目绑定目录下的文档片段可能已进入资产证据。'
        : 'L3 未开启：不会读取该项目绑定目录下的文档。'
    })
  }
  if (assets.length === 0) {
    lines.push({ kind: 'warning', text: '该时段无已确认的成果/过程资产，生成结果可能较空。' })
  }

  const payloadParts: string[] = []
  for (const asset of assets) {
    payloadParts.push(...formatAssetForCloudPreview(asset, nameById))
    payloadParts.push('')
  }

  const label =
    type === 'weekly'
      ? '周复盘'
      : '项目阶段复盘'

  return {
    title: `${label} — 上传预览`,
    lines,
    payloadSummary: payloadParts.join('\n').trim() || '（无资产正文）',
    canProceed: true,
    requiresConsent: false
  }
}

export function buildWeeklyRetroUploadPreview(
  projectId: number | null,
  weekStartMs: number
): UploadPreview {
  const { start, end } = weekBoundsFromStart(weekStartMs)
  return buildRetroUploadPreview('weekly', projectId, start, end)
}

export function isEnhancedSummaryAllowed(projectId: number | null): boolean {
  return isCapabilityEnabled('global', null, PRIVACY_CAPABILITIES.L2_ENHANCED)
}

/** 今日叙事使用云端润色前的上传预览（含规则草稿 + 脱敏活动摘要）。 */
export function buildDailyNarrativeUploadPreview(dateMs: number): UploadPreview {
  const gate = checkCloudAiGate()
  const { start, end } = dayBounds(dateMs)
  const { items } = listActivityLogs({
    startTime: start,
    endTime: end,
    limit: 120
  })
  const dateLabel = new Date(dateMs).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const canAi = !isOfflineMode() && hasApiKey() && canUseCloudAi()
  const plain = buildDailyNarrativePlain(dateMs)
  const bullets = buildDailyNarrativePromptPayload(dateMs, 120)
  const payloadSummary = [`【规则叙事草稿】`, plain, '', `【活动摘要】（最多 120 条）`, bullets].join('\n')

  if (!canAi) {
    return {
      title: '今日叙事 — 上传预览',
      lines: [
        ...gate.lines,
        {
          kind: 'warning',
          text: '当前无法调用云端模型：请检查离线模式、API Key，或在隐私设置中开启「L1 云端结构化」授权。下方为若可用 AI 时将随请求发送的脱敏内容预览。'
        },
        { kind: 'info', text: `${dateLabel} · 共 ${items.length} 条活动片段参与摘要` }
      ],
      payloadSummary,
      canProceed: false,
      requiresConsent: gate.requiresConsent
    }
  }

  const l2 = isCapabilityEnabled('global', null, PRIVACY_CAPABILITIES.L2_ENHANCED)
  const l2note = l2
    ? '已开启 L2：摘要策略与活动报告一致；仍不上传原始窗口标题。'
    : '未开启 L2：仅使用基础脱敏字段。'

  return {
    title: '今日叙事 — 上传预览',
    lines: [
      ...gate.lines,
      { kind: 'info', text: `${dateLabel} 将把下方内容发送至你配置的模型 API，用于润色当日叙事。` },
      { kind: 'info', text: l2note }
    ],
    payloadSummary,
    canProceed: !gate.requiresConsent,
    requiresConsent: gate.requiresConsent
  }
}

export async function buildActivityReportUploadPreview(
  dateStart: number,
  dateEnd: number
): Promise<UploadPreview> {
  const gate = checkCloudAiGate()
  if (isOfflineMode() || !hasApiKey() || !canUseCloudAi()) {
    return gate
  }

  const spanMs = dateEnd - dateStart
  const isWeeklyRange = spanMs > 36 * 60 * 60 * 1000

  if (isWeeklyRange) {
    const weekStart = weekBoundsFromStart(dateStart).start
    const preview = await buildWeeklyContextPreviewSummary(weekStart)
    return {
      title: '活动报告 — 上传预览（周报）',
      lines: [
        ...gate.lines,
        { kind: 'info', text: preview.coverageLine },
        { kind: 'info', text: '将发送 7 日摘要 + 整周统计/Git 证据（非原始 work unit 平铺）。' }
      ],
      payloadSummary: preview.payloadSummary || '（无内容）',
      canProceed: true,
      requiresConsent: false
    }
  }

  const { items } = listActivityLogs({
    startTime: dateStart,
    endTime: dateEnd,
    limit: 200
  })

  const l2 = isCapabilityEnabled('global', null, PRIVACY_CAPABILITIES.L2_ENHANCED)
  const payloadParts: string[] = []

  for (const log of items) {
    const cat = (log.category ?? 'other') as ActivityCategory
    const label = CATEGORY_LABELS[cat]
    const title =
      sanitizeTextForCloud(log.sanitized_title) ||
      sanitizeTextForCloud(log.parsed_file) ||
      log.process_name
    const project = sanitizeTextForCloud(log.parsed_project)
    payloadParts.push(
      `- ${label}${project ? ` | ${project}` : ''}: ${title}（${Math.max(1, Math.round((log.ended_at - log.started_at) / 60000))} 分钟）`
    )
  }

  if (l2) {
    payloadParts.push(
      '',
      '（已开启 L2：可含 Git 统计、浏览器/会议标题摘要、活跃文档片段；不上传原始窗口标题）'
    )
  } else {
    payloadParts.push('', '（未开启 L2：不含 Git diff、文档片段、会议/聊天标题摘要）')
  }

  return {
    title: '活动报告 — 上传预览',
    lines: [
      ...gate.lines,
      { kind: 'info', text: `共 ${items.length} 条活动片段（最多展示 200 条）` }
    ],
    payloadSummary: payloadParts.join('\n') || '（无活动）',
    canProceed: true,
    requiresConsent: false
  }
}

export async function buildSealDailyReportUploadPreview(dateMs: number): Promise<UploadPreview> {
  const gate = checkCloudAiGate()
  const seal = getDailySeal(dateMs)
  const sealText = formatSealBlock(seal)

  if (isOfflineMode() || !hasApiKey() || !canUseCloudAi()) {
    return {
      ...gate,
      title: '盖章日报 — 生成方式',
      payloadSummary: sealText
    }
  }

  const activity = buildActivitySummaryForPrompt(dateMs).slice(0, 2500)
  const assets = buildAssetsSectionForPrompt(dateMs).slice(0, 1800)

  return {
    title: '盖章日报 — AI 上传预览',
    lines: [
      ...gate.lines,
      {
        kind: 'info',
        text: seal
          ? '将发送今日盖章、活动摘要与已确认资产（v3 五段式），不含原始窗口标题。'
          : '当日无盖章记录，生成时将使用活动日志版日报。'
      }
    ],
    payloadSummary: `${sealText}\n\n${activity}\n\n${assets}`,
    canProceed: true,
    requiresConsent: false
  }
}
