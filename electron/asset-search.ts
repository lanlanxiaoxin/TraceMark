import { getDb } from './database'
import { parseAssetSearchQuery, type ParsedAssetSearchQuery } from '../shared/asset-search-query'
import { callChatCompletion } from './ai-gateway'
import { canUseCloudAi } from './privacy-capabilities'
import type { ActivityLogRow } from './activity-logs'
import {
  getWorkAsset,
  listWorkAssets,
  type AssetKind,
  type AssetStatus,
  type EvidenceItem,
  type WorkAsset
} from './work-assets'

export interface ActivityRecallHit {
  id: number
  processName: string
  category: string | null
  sanitizedTitle: string | null
  parsedProject: string | null
  parsedFile: string | null
  startedAt: number
  endedAt: number
}

function evidenceToSearchText(evidence: EvidenceItem[]): string {
  return evidence
    .map(e => {
      const meta =
        e.metadata && typeof e.metadata === 'object'
          ? Object.values(e.metadata)
              .filter(v => typeof v === 'string' || typeof v === 'number')
              .join(' ')
          : ''
      return `${e.type} ${e.summary} ${meta}`.trim()
    })
    .join(' ')
}

function rowEvidenceToText(raw: string | null): string {
  if (!raw) return ''
  try {
    return evidenceToSearchText(JSON.parse(raw) as EvidenceItem[])
  } catch {
    return ''
  }
}

function activityRowToFtsFields(row: ActivityLogRow): {
  title: string
  project: string
  file: string
  process: string
} {
  return {
    title: row.sanitized_title ?? '',
    project: row.parsed_project ?? '',
    file: row.parsed_file ?? '',
    process: row.process_name ?? ''
  }
}

function rowToActivityHit(row: ActivityLogRow): ActivityRecallHit {
  return {
    id: row.id,
    processName: row.process_name,
    category: row.category,
    sanitizedTitle: row.sanitized_title,
    parsedProject: row.parsed_project,
    parsedFile: row.parsed_file,
    startedAt: row.started_at,
    endedAt: row.ended_at
  }
}

function toFtsMatchQuery(text: string): string | null {
  const tokens = text
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/"/g, '""'))
    .filter(t => t.length > 0)
  if (tokens.length === 0) return null
  return tokens.map(t => `"${t}"*`).join(' AND ')
}

function matchesActivityDate(row: ActivityLogRow, parsed: ParsedAssetSearchQuery): boolean {
  if (parsed.dateStart === undefined || parsed.dateEnd === undefined) return true
  return row.started_at <= parsed.dateEnd && row.ended_at >= parsed.dateStart
}

function matchesParsedFilters(
  asset: WorkAsset,
  parsed: ParsedAssetSearchQuery,
  statuses: AssetStatus[]
): boolean {
  if (!statuses.includes(asset.status)) return false
  if (parsed.assetKind && asset.assetKind !== parsed.assetKind) return false

  if (parsed.dateStart !== undefined && parsed.dateEnd !== undefined) {
    const start = asset.startedAt ?? asset.createdAt
    const end = asset.endedAt ?? asset.startedAt ?? asset.createdAt
    if (start > parsed.dateEnd) return false
    if (end < parsed.dateStart) return false
  }
  return true
}

export function rebuildWorkAssetsFts(): void {
  const db = getDb()
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='work_assets_fts'")
    .get() as { ok: number } | undefined
  if (!table) return

  db.exec('DELETE FROM work_assets_fts')
  const rows = db
    .prepare(`SELECT id, title, description, impact, evidence_json FROM work_assets`)
    .all() as Array<{
    id: number
    title: string
    description: string | null
    impact: string | null
    evidence_json: string | null
  }>

  const insert = db.prepare(
    `INSERT INTO work_assets_fts (asset_id, title, description, impact, evidence_text)
     VALUES (?, ?, ?, ?, ?)`
  )
  const tx = db.transaction(() => {
    for (const row of rows) {
      insert.run(
        row.id,
        row.title,
        row.description ?? '',
        row.impact ?? '',
        rowEvidenceToText(row.evidence_json)
      )
    }
  })
  tx()
}

export function rebuildActivityLogsFts(): void {
  const db = getDb()
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='activity_logs_fts'")
    .get() as { ok: number } | undefined
  if (!table) return

  db.exec('DELETE FROM activity_logs_fts')
  const rows = db
    .prepare(
      `SELECT id, process_name, category, parsed_project, parsed_file, sanitized_title,
              started_at, ended_at, is_deleted
       FROM activity_logs WHERE is_deleted = 0`
    )
    .all() as ActivityLogRow[]

  const insert = db.prepare(
    `INSERT INTO activity_logs_fts (log_id, title, project, file, process_name)
     VALUES (?, ?, ?, ?, ?)`
  )
  const tx = db.transaction(() => {
    for (const row of rows) {
      const fields = activityRowToFtsFields(row)
      insert.run(row.id, fields.title, fields.project, fields.file, fields.process)
    }
  })
  tx()
}

export function initRecallSearch(): void {
  const db = getDb()

  const assetsFts = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='work_assets_fts'")
    .get() as { ok: number } | undefined
  if (!assetsFts) {
    db.exec(`
      CREATE VIRTUAL TABLE work_assets_fts USING fts5(
        asset_id UNINDEXED,
        title,
        description,
        impact,
        evidence_text,
        tokenize='unicode61'
      );
    `)
    rebuildWorkAssetsFts()
  } else {
    const count = db.prepare('SELECT COUNT(*) AS c FROM work_assets_fts').get() as { c: number }
    const assets = db.prepare('SELECT COUNT(*) AS c FROM work_assets').get() as { c: number }
    if (count.c === 0 && assets.c > 0) rebuildWorkAssetsFts()
  }

  const activityFts = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='activity_logs_fts'")
    .get() as { ok: number } | undefined
  if (!activityFts) {
    db.exec(`
      CREATE VIRTUAL TABLE activity_logs_fts USING fts5(
        log_id UNINDEXED,
        title,
        project,
        file,
        process_name,
        tokenize='unicode61'
      );
    `)
    rebuildActivityLogsFts()
  } else {
    const count = db.prepare('SELECT COUNT(*) AS c FROM activity_logs_fts').get() as { c: number }
    const logs = db
      .prepare('SELECT COUNT(*) AS c FROM activity_logs WHERE is_deleted = 0')
      .get() as { c: number }
    if (count.c === 0 && logs.c > 0) rebuildActivityLogsFts()
  }
}

/** @deprecated 使用 initRecallSearch */
export function initWorkAssetSearch(): void {
  initRecallSearch()
}

export function syncWorkAssetFts(asset: WorkAsset): void {
  const db = getDb()
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='work_assets_fts'")
    .get() as { ok: number } | undefined
  if (!table) return

  db.prepare('DELETE FROM work_assets_fts WHERE asset_id = ?').run(asset.id)
  db.prepare(
    `INSERT INTO work_assets_fts (asset_id, title, description, impact, evidence_text)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    asset.id,
    asset.title,
    asset.description ?? '',
    asset.impact ?? '',
    evidenceToSearchText(asset.evidence)
  )
}

export function deleteWorkAssetFts(id: number): void {
  const db = getDb()
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='work_assets_fts'")
    .get() as { ok: number } | undefined
  if (!table) return
  db.prepare('DELETE FROM work_assets_fts WHERE asset_id = ?').run(id)
}

export function syncActivityLogFts(row: ActivityLogRow): void {
  const db = getDb()
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='activity_logs_fts'")
    .get() as { ok: number } | undefined
  if (!table) return

  db.prepare('DELETE FROM activity_logs_fts WHERE log_id = ?').run(row.id)
  if (row.is_deleted) return

  const fields = activityRowToFtsFields(row)
  db.prepare(
    `INSERT INTO activity_logs_fts (log_id, title, project, file, process_name)
     VALUES (?, ?, ?, ?, ?)`
  ).run(row.id, fields.title, fields.project, fields.file, fields.process)
}

export function deleteActivityLogFts(id: number): void {
  const db = getDb()
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='activity_logs_fts'")
    .get() as { ok: number } | undefined
  if (!table) return
  db.prepare('DELETE FROM activity_logs_fts WHERE log_id = ?').run(id)
}

function searchActivitiesFts(
  parsed: ParsedAssetSearchQuery,
  limit: number
): { hits: ActivityRecallHit[]; usedFts: boolean } {
  const db = getDb()
  if (!parsed.text) return { hits: [], usedFts: false }

  const ftsQuery = toFtsMatchQuery(parsed.text)
  if (!ftsQuery) return { hits: [], usedFts: false }

  try {
    const rows = db
      .prepare(
        `SELECT log_id FROM activity_logs_fts
         WHERE activity_logs_fts MATCH ?
         ORDER BY bm25(activity_logs_fts)
         LIMIT ?`
      )
      .all(ftsQuery, limit * 4) as Array<{ log_id: number }>

    if (rows.length === 0) return { hits: [], usedFts: false }

    const hits: ActivityRecallHit[] = []
    const seen = new Set<number>()
    for (const row of rows) {
      if (seen.has(row.log_id)) continue
      seen.add(row.log_id)
      const log = db
        .prepare(
          `SELECT id, process_name, category, parsed_project, parsed_file, sanitized_title,
                  started_at, ended_at, is_deleted
           FROM activity_logs WHERE id = ? AND is_deleted = 0`
        )
        .get(row.log_id) as ActivityLogRow | undefined
      if (log && matchesActivityDate(log, parsed)) {
        hits.push(rowToActivityHit(log))
      }
    }
    return { hits, usedFts: hits.length > 0 }
  } catch {
    return { hits: [], usedFts: false }
  }
}

function searchActivitiesLike(
  parsed: ParsedAssetSearchQuery,
  limit: number
): ActivityRecallHit[] {
  if (!parsed.text) return []
  const db = getDb()
  const q = `%${parsed.text.trim()}%`
  const rows = db
    .prepare(
      `SELECT id, process_name, category, parsed_project, parsed_file, sanitized_title,
              started_at, ended_at, is_deleted
       FROM activity_logs
       WHERE is_deleted = 0
         AND (sanitized_title LIKE ? OR parsed_file LIKE ? OR parsed_project LIKE ?
              OR process_name LIKE ?)
       ORDER BY started_at DESC
       LIMIT ?`
    )
    .all(q, q, q, q, limit * 2) as ActivityLogRow[]

  return rows.filter(r => matchesActivityDate(r, parsed)).map(rowToActivityHit)
}

async function rerankWithAi(query: string, assets: WorkAsset[]): Promise<WorkAsset[]> {
  if (assets.length < 2 || !canUseCloudAi()) return assets

  const slice = assets.slice(0, 12)
  const lines = slice.map(a => `[id=${a.id}] ${a.title}`)
  const system =
    'You reorder personal work asset search results. Reply with ONLY comma-separated numeric ids, best match first. No explanation.'
  const prompt = `User query: ${query}\n\nAssets:\n${lines.join('\n')}`

  try {
    const raw = await callChatCompletion(prompt, system)
    const ids = [...raw.matchAll(/\d+/g)]
      .map(m => Number(m[0]))
      .filter(id => slice.some(a => a.id === id))
    if (ids.length === 0) return assets

    const byId = new Map(slice.map(a => [a.id, a]))
    const ordered: WorkAsset[] = []
    for (const id of ids) {
      const a = byId.get(id)
      if (a) ordered.push(a)
    }
    for (const a of slice) {
      if (!ordered.includes(a)) ordered.push(a)
    }
    const rest = assets.filter(a => !ordered.includes(a))
    return [...ordered, ...rest]
  } catch {
    return assets
  }
}

export interface RecallSearchOptions {
  query: string
  limit?: number
  rerank?: boolean
  status?: AssetStatus[]
  activityLimit?: number
}

export interface RecallSearchResult {
  items: WorkAsset[]
  activities: ActivityRecallHit[]
  parsed: ParsedAssetSearchQuery
  usedFts: boolean
  activityUsedFts: boolean
  reranked: boolean
}

export async function searchWorkAssetsRecall(
  options: RecallSearchOptions
): Promise<RecallSearchResult> {
  const parsed = parseAssetSearchQuery(options.query)
  const limit = options.limit ?? 20
  const activityLimit = options.activityLimit ?? 8
  const statuses: AssetStatus[] = options.status ?? ['confirmed', 'private', 'suggested']
  const db = getDb()

  let items: WorkAsset[] = []
  let usedFts = false

  if (parsed.text) {
    const ftsQuery = toFtsMatchQuery(parsed.text)
    if (ftsQuery) {
      try {
        const rows = db
          .prepare(
            `SELECT asset_id FROM work_assets_fts
             WHERE work_assets_fts MATCH ?
             ORDER BY bm25(work_assets_fts)
             LIMIT ?`
          )
          .all(ftsQuery, limit * 4) as Array<{ asset_id: number }>

        if (rows.length > 0) {
          usedFts = true
          const seen = new Set<number>()
          for (const row of rows) {
            if (seen.has(row.asset_id)) continue
            seen.add(row.asset_id)
            const asset = getWorkAsset(row.asset_id)
            if (asset && matchesParsedFilters(asset, parsed, statuses)) {
              items.push(asset)
            }
          }
        }
      } catch {
        usedFts = false
      }
    }
  }

  if (!usedFts) {
    const filter: Parameters<typeof listWorkAssets>[0] = {
      status: statuses,
      limit: limit * 2,
      dateStart: parsed.dateStart,
      dateEnd: parsed.dateEnd
    }
    if (parsed.assetKind) filter.assetKind = parsed.assetKind as AssetKind
    if (parsed.text) filter.search = parsed.text
    items = listWorkAssets(filter)
    if (parsed.text) {
      const q = parsed.text.toLowerCase()
      items = items.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q) ?? false) ||
          (a.impact?.toLowerCase().includes(q) ?? false) ||
          evidenceToSearchText(a.evidence).toLowerCase().includes(q)
      )
    }
  }

  let reranked = false
  if (options.rerank && parsed.text && items.length > 1) {
    items = await rerankWithAi(parsed.text, items)
    reranked = true
  }

  let activities: ActivityRecallHit[] = []
  let activityUsedFts = false
  if (parsed.text && !parsed.assetKind) {
    const activityFts = searchActivitiesFts(parsed, activityLimit)
    activities = activityFts.hits
    activityUsedFts = activityFts.usedFts
    if (activities.length === 0) {
      activities = searchActivitiesLike(parsed, activityLimit)
    }
  }

  return {
    items: items.slice(0, limit),
    activities: activities.slice(0, activityLimit),
    parsed,
    usedFts,
    activityUsedFts,
    reranked
  }
}
