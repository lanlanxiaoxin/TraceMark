import { deleteWorkAssetFts, syncWorkAssetFts } from './asset-search'
import { getDb } from './database'

export type AssetKind = 'outcome' | 'process' | 'evidence'
export type AssetStatus = 'suggested' | 'confirmed' | 'ignored' | 'private'
export type AssetConfidence = 'high' | 'medium' | 'low'
export type PrivacyLevel = 'local' | 'structured_cloud' | 'enhanced_cloud'

export interface EvidenceItem {
  type: string
  summary: string
  activityLogId?: number
  startedAt?: number
  endedAt?: number
  metadata?: Record<string, unknown>
}

export interface WorkAsset {
  id: number
  projectId: number | null
  title: string
  assetKind: AssetKind
  assetType: string
  description: string | null
  impact: string | null
  confidence: AssetConfidence
  status: AssetStatus
  privacyLevel: PrivacyLevel
  startedAt: number | null
  endedAt: number | null
  evidence: EvidenceItem[]
  tags: string[]
  createdAt: number
  updatedAt: number
}

interface WorkAssetRow {
  id: number
  project_id: number | null
  title: string
  asset_kind: string
  asset_type: string
  description: string | null
  impact: string | null
  confidence: string
  status: string
  privacy_level: string
  started_at: number | null
  ended_at: number | null
  evidence_json: string | null
  tags_json: string | null
  created_at: number
  updated_at: number
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function rowToWorkAsset(row: WorkAssetRow): WorkAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    assetKind: row.asset_kind as AssetKind,
    assetType: row.asset_type,
    description: row.description,
    impact: row.impact,
    confidence: row.confidence as AssetConfidence,
    status: row.status as AssetStatus,
    privacyLevel: row.privacy_level as PrivacyLevel,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    evidence: parseJson<EvidenceItem[]>(row.evidence_json, []),
    tags: parseJson<string[]>(row.tags_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface WorkAssetFilter {
  projectId?: number | null
  status?: AssetStatus | AssetStatus[]
  assetKind?: AssetKind | AssetKind[]
  search?: string
  dateStart?: number
  dateEnd?: number
  limit?: number
  offset?: number
}

export interface CreateWorkAssetInput {
  projectId?: number | null
  title: string
  assetKind: AssetKind
  assetType: string
  description?: string
  impact?: string
  confidence?: AssetConfidence
  status?: AssetStatus
  privacyLevel?: PrivacyLevel
  startedAt?: number
  endedAt?: number
  evidence?: EvidenceItem[]
  tags?: string[]
}

export function createWorkAsset(input: CreateWorkAssetInput): WorkAsset {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(
      `INSERT INTO work_assets (
        project_id, title, asset_kind, asset_type, description, impact,
        confidence, status, privacy_level, started_at, ended_at,
        evidence_json, tags_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.projectId ?? null,
      input.title,
      input.assetKind,
      input.assetType,
      input.description ?? null,
      input.impact ?? null,
      input.confidence ?? 'medium',
      input.status ?? 'suggested',
      input.privacyLevel ?? 'structured_cloud',
      input.startedAt ?? null,
      input.endedAt ?? null,
      JSON.stringify(input.evidence ?? []),
      JSON.stringify(input.tags ?? []),
      now,
      now
    )
  const created = getWorkAsset(Number(result.lastInsertRowid))!
  syncWorkAssetFts(created)
  return created
}

export function getWorkAsset(id: number): WorkAsset | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM work_assets WHERE id = ?').get(id) as WorkAssetRow | undefined
  return row ? rowToWorkAsset(row) : null
}

export function listWorkAssets(filter: WorkAssetFilter = {}): WorkAsset[] {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.projectId !== undefined) {
    if (filter.projectId === null) {
      conditions.push('project_id IS NULL')
    } else {
      conditions.push('project_id = ?')
      params.push(filter.projectId)
    }
  }

  if (filter.status !== undefined) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    conditions.push(`status IN (${statuses.map(() => '?').join(',')})`)
    params.push(...statuses)
  }

  if (filter.assetKind !== undefined) {
    const kinds = Array.isArray(filter.assetKind) ? filter.assetKind : [filter.assetKind]
    conditions.push(`asset_kind IN (${kinds.map(() => '?').join(',')})`)
    params.push(...kinds)
  }

  if (filter.search?.trim()) {
    const q = `%${filter.search.trim()}%`
    conditions.push('(title LIKE ? OR description LIKE ? OR impact LIKE ?)')
    params.push(q, q, q)
  }

  if (filter.dateStart !== undefined && filter.dateEnd !== undefined) {
    conditions.push(
      '(started_at IS NULL OR started_at <= ?) AND (ended_at IS NULL OR ended_at >= ?)'
    )
    params.push(filter.dateEnd, filter.dateStart)
  } else {
    if (filter.dateStart !== undefined) {
      conditions.push('(ended_at IS NULL OR ended_at >= ?)')
      params.push(filter.dateStart)
    }
    if (filter.dateEnd !== undefined) {
      conditions.push('(started_at IS NULL OR started_at <= ?)')
      params.push(filter.dateEnd)
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filter.limit ?? 200
  const offset = filter.offset ?? 0

  const rows = db
    .prepare(
      `SELECT * FROM work_assets ${where} ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as WorkAssetRow[]

  return rows.map(rowToWorkAsset)
}

export interface UpdateWorkAssetPatch {
  title?: string
  assetKind?: AssetKind
  assetType?: string
  description?: string | null
  impact?: string | null
  confidence?: AssetConfidence
  status?: AssetStatus
  privacyLevel?: PrivacyLevel
  projectId?: number | null
  startedAt?: number | null
  endedAt?: number | null
  evidence?: EvidenceItem[]
  tags?: string[]
}

export function markUserTouched(id: number): void {
  const asset = getWorkAsset(id)
  if (!asset) return
  const tags = asset.tags.includes('user-touched')
    ? asset.tags
    : [...asset.tags, 'user-touched']
  updateWorkAsset(id, { tags })
}

export function updateWorkAsset(id: number, patch: UpdateWorkAssetPatch): WorkAsset | null {
  const existing = getWorkAsset(id)
  if (!existing) return null

  const db = getDb()
  const now = Date.now()
  const mergedTags = patch.tags ?? existing.tags
  const tags =
    patch.title !== undefined && patch.title !== existing.title
      ? mergedTags.includes('user-touched')
        ? mergedTags
        : [...mergedTags, 'user-touched']
      : mergedTags

  db.prepare(
    `UPDATE work_assets SET
      project_id = ?, title = ?, asset_kind = ?, asset_type = ?,
      description = ?, impact = ?, confidence = ?, status = ?,
      privacy_level = ?, started_at = ?, ended_at = ?,
      evidence_json = ?, tags_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    patch.projectId !== undefined ? patch.projectId : existing.projectId,
    patch.title ?? existing.title,
    patch.assetKind ?? existing.assetKind,
    patch.assetType ?? existing.assetType,
    patch.description !== undefined ? patch.description : existing.description,
    patch.impact !== undefined ? patch.impact : existing.impact,
    patch.confidence ?? existing.confidence,
    patch.status ?? existing.status,
    patch.privacyLevel ?? existing.privacyLevel,
    patch.startedAt !== undefined ? patch.startedAt : existing.startedAt,
    patch.endedAt !== undefined ? patch.endedAt : existing.endedAt,
    JSON.stringify(patch.evidence ?? existing.evidence),
    JSON.stringify(tags),
    now,
    id
  )
  const updated = getWorkAsset(id)
  if (updated) syncWorkAssetFts(updated)
  return updated
}

export function countWorkAssetsByProject(projectId: number): number {
  const db = getDb()
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM work_assets WHERE project_id = ?')
    .get(projectId) as { c: number }
  return row.c
}

export function deleteWorkAsset(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM work_assets WHERE id = ?').run(id)
  if (result.changes > 0) deleteWorkAssetFts(id)
  return result.changes > 0
}

export function countSuggestedForDay(dayStartMs: number, dayEndMs: number): number {
  const items = listWorkAssets({
    status: 'suggested',
    dateStart: dayStartMs,
    dateEnd: dayEndMs
  })
  return items.length
}

export interface SplitWorkAssetPart {
  title: string
  assetKind: AssetKind
  description?: string
  evidence?: EvidenceItem[]
}

function timeBoundsFromEvidence(evidence: EvidenceItem[]): {
  startedAt?: number
  endedAt?: number
} {
  const starts = evidence.map(e => e.startedAt).filter((t): t is number => t != null)
  const ends = evidence.map(e => e.endedAt).filter((t): t is number => t != null)
  if (starts.length === 0 && ends.length === 0) return {}
  return {
    startedAt: starts.length > 0 ? Math.min(...starts) : undefined,
    endedAt: ends.length > 0 ? Math.max(...ends) : undefined
  }
}

export function splitWorkAsset(id: number, parts: SplitWorkAssetPart[]): WorkAsset[] {
  if (parts.length < 2) return []

  const source = getWorkAsset(id)
  if (!source) return []

  const evidenceA = parts[0].evidence ?? source.evidence
  const boundsA = timeBoundsFromEvidence(evidenceA)

  updateWorkAsset(id, {
    title: parts[0].title,
    assetKind: parts[0].assetKind,
    description: parts[0].description ?? source.description,
    evidence: evidenceA,
    startedAt: boundsA.startedAt ?? source.startedAt ?? undefined,
    endedAt: boundsA.endedAt ?? source.endedAt ?? undefined,
    tags: [...source.tags.filter(t => t !== 'user-touched'), 'user-touched']
  })

  const created: WorkAsset[] = []
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const evidenceB = part.evidence ?? []
    const boundsB = timeBoundsFromEvidence(evidenceB)
    created.push(
      createWorkAsset({
        projectId: source.projectId,
        title: part.title,
        assetKind: part.assetKind,
        assetType: source.assetType,
        description: part.description,
        confidence: source.confidence,
        status: source.status,
        privacyLevel: source.privacyLevel,
        startedAt: boundsB.startedAt ?? source.startedAt ?? undefined,
        endedAt: boundsB.endedAt ?? source.endedAt ?? undefined,
        evidence: evidenceB,
        tags: ['user-touched', `split-from:${id}`]
      })
    )
  }

  const primary = getWorkAsset(id)
  return primary ? [primary, ...created] : created
}

export function mergeWorkAssets(ids: number[]): WorkAsset | null {
  if (ids.length < 2) return ids[0] ? getWorkAsset(ids[0]) : null

  const assets = ids.map(id => getWorkAsset(id)).filter((a): a is WorkAsset => a !== null)
  if (assets.length < 2) return assets[0] ?? null

  const durationMs = (a: WorkAsset): number => (a.endedAt ?? 0) - (a.startedAt ?? 0)
  const primary = assets.reduce((a, b) => (durationMs(a) >= durationMs(b) ? a : b), assets[0])

  const mergedEvidence = assets.flatMap(a => a.evidence)
  const startedAt = Math.min(...assets.map(a => a.startedAt ?? Infinity))
  const endedAt = Math.max(...assets.map(a => a.endedAt ?? 0))

  const merged = updateWorkAsset(primary.id, {
    title: `${primary.title}（已合并）`,
    evidence: mergedEvidence,
    startedAt: Number.isFinite(startedAt) ? startedAt : primary.startedAt ?? undefined,
    endedAt: endedAt || (primary.endedAt ?? undefined)
  })

  for (const asset of assets) {
    if (asset.id !== primary.id) {
      updateWorkAsset(asset.id, { status: 'ignored' })
    }
  }

  return merged
}

export function hasTerminalStatusForDay(dayStartMs: number, dayEndMs: number): boolean {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM work_assets
       WHERE status IN ('confirmed', 'ignored')
       AND started_at >= ? AND started_at <= ?`
    )
    .get(dayStartMs, dayEndMs) as { c: number }
  return row.c > 0
}
