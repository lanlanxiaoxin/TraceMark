import { getDb } from './database'
import { listActivityLogs, type ActivityLogRow } from './activity-logs'
import { CATEGORY_LABELS, type ActivityCategory } from './window-title-parser'
import {
  listProjectSpaces,
  matchProjectId,
  getProjectSpace,
  type ProjectSpace
} from './project-spaces'
import {
  createWorkAsset,
  listWorkAssets,
  deleteWorkAsset,
  updateWorkAsset,
  type AssetKind,
  type AssetConfidence,
  type EvidenceItem,
  type WorkAsset
} from './work-assets'
import { createSessionSummary } from './session-summaries'
import { loadGitDiffSnapshots } from './enrichment/git-enrichment'
import { sanitizeTextForCloud } from './sanitizer'
import { isCapabilityEnabled, PRIVACY_CAPABILITIES } from './privacy-capabilities'
import { collectEnhancedEvidenceForUnit } from './enrichment/enhanced-summary'

const MIN_CARD_MS = 8 * 60 * 1000
const MAX_CARDS = 8
const MIN_CARDS = 1
const USER_TOUCHED_TAG = 'user-touched'
const TOUCHED_MS_THRESHOLD = 2000

interface ActivityUnit {
  projectId: number | null
  projectName: string | null
  category: ActivityCategory
  startedAt: number
  endedAt: number
  durationMs: number
  logs: ActivityLogRow[]
}

export function dayBounds(dateMs: number): { start: number; end: number } {
  const start = new Date(dateMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateMs)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

export function listSuggestedForDay(dateMs: number): WorkAsset[] {
  const { start, end } = dayBounds(dateMs)
  return listWorkAssets({
    status: 'suggested',
    dateStart: start,
    dateEnd: end
  })
}

export function listAllAssetsForDay(dateMs: number): WorkAsset[] {
  const { start, end } = dayBounds(dateMs)
  return listWorkAssets({
    dateStart: start,
    dateEnd: end,
    limit: 500
  })
}

export function hasAnyAssetsForDay(dateMs: number): boolean {
  return listAllAssetsForDay(dateMs).length > 0
}

const TERMINAL_STATUSES = new Set(['ignored', 'confirmed', 'private'])

function isTerminalAsset(asset: WorkAsset): boolean {
  return TERMINAL_STATUSES.has(asset.status)
}

function buildGenKey(unit: ActivityUnit): string {
  return `gen:${unit.projectId ?? 0}:${unit.startedAt}:${unit.category}`
}

export function isUserTouched(asset: WorkAsset): boolean {
  if (asset.tags.includes(USER_TOUCHED_TAG)) return true
  return asset.updatedAt - asset.createdAt > TOUCHED_MS_THRESHOLD
}

function findByGenKey(assets: WorkAsset[], genKey: string): WorkAsset | undefined {
  return assets.find(a => a.tags.includes(genKey))
}

function aggregateLogs(logs: ActivityLogRow[]): ActivityUnit[] {
  const sorted = [...logs].sort((a, b) => a.started_at - b.started_at)
  const units: ActivityUnit[] = []

  for (const log of sorted) {
    const category = (log.category ?? 'other') as ActivityCategory
    const projectId = matchProjectId(log.parsed_project, log.window_title, log.sanitized_title, {
      category: log.category,
      parsedFile: log.parsed_file,
      processName: log.process_name,
      executablePath: log.executable_path
    })
    const projectName = projectId ? getProjectSpace(projectId)?.name ?? log.parsed_project : log.parsed_project
    const last = units[units.length - 1]

    if (
      last &&
      last.projectId === projectId &&
      last.category === category &&
      log.started_at - last.endedAt < 5 * 60 * 1000
    ) {
      last.endedAt = log.ended_at
      last.durationMs += log.ended_at - log.started_at
      last.logs.push(log)
      continue
    }

    units.push({
      projectId,
      projectName,
      category,
      startedAt: log.started_at,
      endedAt: log.ended_at,
      durationMs: log.ended_at - log.started_at,
      logs: [log]
    })
  }

  return units
}

function buildEvidence(unit: ActivityUnit, projectName: string | null): EvidenceItem[] {
  const evidence: EvidenceItem[] = []
  const l2 = isCapabilityEnabled('global', null, PRIVACY_CAPABILITIES.L2_ENHANCED)

  for (const log of unit.logs) {
    const summary =
      sanitizeTextForCloud(log.sanitized_title) ||
      sanitizeTextForCloud(log.parsed_file) ||
      log.process_name
    evidence.push({
      type: log.category ?? 'activity',
      summary: summary ?? '活动片段',
      activityLogId: log.id,
      startedAt: log.started_at,
      endedAt: log.ended_at
    })
  }

  if (projectName && l2) {
    const gitSnaps = loadGitDiffSnapshots(projectName, unit.startedAt)
    for (const snap of gitSnaps.slice(-2)) {
      evidence.push({
        type: 'git',
        summary: `变更 ${snap.filesChanged} 个文件 (+${snap.insertions}/-${snap.deletions})`,
        metadata: {
          filesChanged: snap.filesChanged,
          insertions: snap.insertions,
          deletions: snap.deletions
        }
      })
    }
  }

  const logIds = unit.logs.map(l => l.id)
  for (const item of collectEnhancedEvidenceForUnit(
    unit.projectId,
    logIds,
    unit.startedAt,
    unit.endedAt
  )) {
    if (!evidence.some(e => e.summary === item.summary && e.type === item.type)) {
      evidence.push(item)
    }
  }

  return evidence
}

function inferAssetKind(unit: ActivityUnit, evidence: EvidenceItem[]): AssetKind {
  const hasGit = evidence.some(e => e.type === 'git')
  const codingMs = unit.category === 'code_editor' ? unit.durationMs : 0
  if (hasGit || (codingMs >= 20 * 60 * 1000 && unit.logs.some(l => l.parsed_file))) {
    return 'outcome'
  }
  if (unit.category === 'browser' || unit.category === 'docs' || unit.durationMs >= 25 * 60 * 1000) {
    return 'process'
  }
  return 'process'
}

function inferConfidence(unit: ActivityUnit, evidence: EvidenceItem[]): AssetConfidence {
  if (unit.logs.some(l => l.user_note?.trim())) return 'high'
  if (evidence.some(e => e.type === 'git')) return 'high'
  if (unit.durationMs < 5 * 60 * 1000) return 'low'
  return 'medium'
}

function buildTitle(unit: ActivityUnit, space: ProjectSpace | null): string {
  const label = CATEGORY_LABELS[unit.category] ?? unit.category
  const file = unit.logs.find(l => l.parsed_file)?.parsed_file
  const project = space?.name ?? unit.projectName
  const mins = Math.round(unit.durationMs / 60000)

  if (file && unit.category === 'code_editor') {
    return `${project ? `[${project}] ` : ''}编码：${file.split(/[/\\]/).pop()}（${mins} 分钟）`
  }
  if (unit.category === 'browser') {
    const title = unit.logs.find(l => l.sanitized_title)?.sanitized_title
    return `${project ? `[${project}] ` : ''}浏览调研：${title ?? label}（${mins} 分钟）`
  }
  if (unit.category === 'meeting' || unit.category === 'communication') {
    const title = unit.logs.find(l => l.sanitized_title)?.sanitized_title
    return `${project ? `[${project}] ` : ''}${label}：${title ?? '会话'}（${mins} 分钟）`
  }
  if (unit.category === 'docs' && file) {
    return `${project ? `[${project}] ` : ''}文档：${file.split(/[/\\]/).pop()}（${mins} 分钟）`
  }
  return `${project ? `[${project}] ` : ''}${label}（${mins} 分钟）`
}

function removeOrphanSuggested(
  dayStart: number,
  dayEnd: number,
  activeGenKeys: Set<string>,
  existingSuggested: WorkAsset[]
): void {
  for (const asset of existingSuggested) {
    if (isUserTouched(asset)) continue
    const genKey = asset.tags.find(t => t.startsWith('gen:'))
    if (!genKey || !activeGenKeys.has(genKey)) {
      deleteWorkAsset(asset.id)
    }
  }
}

function upsertSuggestedFromUnit(
  unit: ActivityUnit,
  spaces: ProjectSpace[],
  existingAll: WorkAsset[]
): WorkAsset | null {
  const space = unit.projectId ? spaces.find(s => s.id === unit.projectId) ?? null : null
  const projectName = space?.name ?? unit.projectName
  const evidence = buildEvidence(unit, projectName)
  const assetKind = inferAssetKind(unit, evidence)
  const confidence = inferConfidence(unit, evidence)
  const title = buildTitle(unit, space)
  const genKey = buildGenKey(unit)
  const existing = findByGenKey(existingAll, genKey)

  if (existing && isTerminalAsset(existing)) {
    return null
  }

  const payload = {
    projectId: unit.projectId,
    title,
    assetKind,
    assetType: unit.category,
    description: confidence === 'low' ? '待确认：请补充一句话说明具体成果' : undefined,
    confidence,
    status: 'suggested' as const,
    startedAt: unit.startedAt,
    endedAt: unit.endedAt,
    evidence,
    tags: [genKey]
  }

  if (existing) {
    if (isUserTouched(existing)) return existing
    return updateWorkAsset(existing.id, payload)
  }

  const asset = createWorkAsset(payload)
  const primary = evidence[0]
  if (primary) {
    createSessionSummary({
      projectId: unit.projectId,
      activityLogId: primary.activityLogId,
      sourceType:
        unit.category === 'browser'
          ? 'browser'
          : unit.category === 'code_editor'
            ? 'git'
            : 'document',
      summary: primary.summary,
      sourceLevel: 'safe'
    })
  }
  return asset
}

/** 同步生成；幂等：保留 user-touched，按 genKey upsert，事务包裹 */
export function generateSuggestedAssets(dateMs: number, force = false): number {
  const { start, end } = dayBounds(dateMs)
  const db = getDb()

  return db.transaction(() => {
    const { items: logs } = listActivityLogs({ startTime: start, endTime: end, limit: 5000 })
    if (logs.length === 0) return 0

    let existingSuggested = listSuggestedForDay(dateMs)
    const existingAll = listAllAssetsForDay(dateMs)
    if (!force && existingSuggested.length > 0) return existingSuggested.length
    if (!force && existingAll.length > 0 && existingSuggested.length === 0) {
      return 0
    }

    let units = aggregateLogs(logs).filter(u => u.durationMs >= MIN_CARD_MS)
    units.sort((a, b) => b.durationMs - a.durationMs)

    if (units.length === 0 && logs.length > 0) {
      units = aggregateLogs(logs)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, MAX_CARDS)
    } else {
      units = units.slice(0, MAX_CARDS)
    }

    if (units.length < MIN_CARDS && logs.length > 0) {
      const u = aggregateLogs(logs).sort((a, b) => b.durationMs - a.durationMs)[0]
      if (u) units = [u]
    }

    const spaces = listProjectSpaces()
    const activeGenKeys = new Set<string>()
    let created = 0
    let allAssets = existingAll

    for (const unit of units) {
      const genKey = buildGenKey(unit)
      activeGenKeys.add(genKey)
      const asset = upsertSuggestedFromUnit(unit, spaces, allAssets)
      if (asset) {
        allAssets = listAllAssetsForDay(dateMs)
        existingSuggested = listSuggestedForDay(dateMs)
        created++
      }
    }

    if (created === 0 && logs.length > 0 && !existingSuggested.some(a => a.title.includes('未分类'))) {
      const totalMs = logs.reduce((s, l) => s + (l.ended_at - l.started_at), 0)
      const genKey = `gen:0:${logs[0].started_at}:mixed`
      activeGenKeys.add(genKey)
      const existing = findByGenKey(allAssets, genKey)
      if (existing && isTerminalAsset(existing)) {
        // 用户已忽略/确认过同日未分类卡，不再重建
      } else if (!existing || !isUserTouched(existing)) {
        if (existing) {
          updateWorkAsset(existing.id, {
            title: `未分类工作（${Math.round(totalMs / 60000)} 分钟）`,
            evidence: logs.slice(0, 5).map(l => ({
              type: 'activity',
              summary: l.sanitized_title || l.process_name,
              activityLogId: l.id,
              startedAt: l.started_at,
              endedAt: l.ended_at
            })),
            tags: [genKey]
          })
        } else {
          createWorkAsset({
            projectId: null,
            title: `未分类工作（${Math.round(totalMs / 60000)} 分钟）`,
            assetKind: 'process',
            assetType: 'mixed',
            confidence: 'low',
            status: 'suggested',
            startedAt: logs[0].started_at,
            endedAt: logs[logs.length - 1].ended_at,
            evidence: logs.slice(0, 5).map(l => ({
              type: 'activity',
              summary: l.sanitized_title || l.process_name,
              activityLogId: l.id,
              startedAt: l.started_at,
              endedAt: l.ended_at
            })),
            tags: [genKey]
          })
        }
        created = 1
      }
    }

    existingSuggested = listSuggestedForDay(dateMs)
    removeOrphanSuggested(start, end, activeGenKeys, existingSuggested)

    return listSuggestedForDay(dateMs).length
  })()
}
