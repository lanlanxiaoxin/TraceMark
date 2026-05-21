import { getDb } from './database'

export type RetroType = 'weekly' | 'project_phase'

export interface Retrospective {
  id: number
  projectId: number | null
  type: RetroType
  dateStart: number
  dateEnd: number
  content: string
  sourceAssetIds: number[]
  createdAt: number
  updatedAt: number
}

interface RetrospectiveRow {
  id: number
  project_id: number | null
  type: string
  date_start: number
  date_end: number
  content: string
  source_asset_ids_json: string | null
  created_at: number
  updated_at: number
}

function parseAssetIds(raw: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}

function rowToRetro(row: RetrospectiveRow): Retrospective {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as RetroType,
    dateStart: row.date_start,
    dateEnd: row.date_end,
    content: row.content,
    sourceAssetIds: parseAssetIds(row.source_asset_ids_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface RetrospectiveFilter {
  projectId?: number | null
  type?: RetroType
  limit?: number
}

export interface CreateRetrospectiveInput {
  projectId?: number | null
  type: RetroType
  dateStart: number
  dateEnd: number
  content: string
  sourceAssetIds?: number[]
}

export function createRetrospective(input: CreateRetrospectiveInput): Retrospective {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(
      `INSERT INTO retrospectives (
        project_id, type, date_start, date_end, content,
        source_asset_ids_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.projectId ?? null,
      input.type,
      input.dateStart,
      input.dateEnd,
      input.content,
      JSON.stringify(input.sourceAssetIds ?? []),
      now,
      now
    )
  return getRetrospective(Number(result.lastInsertRowid))!
}

export function getRetrospective(id: number): Retrospective | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM retrospectives WHERE id = ?').get(id) as
    | RetrospectiveRow
    | undefined
  return row ? rowToRetro(row) : null
}

export function listRetrospectives(filter: RetrospectiveFilter = {}): Retrospective[] {
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

  if (filter.type !== undefined) {
    conditions.push('type = ?')
    params.push(filter.type)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filter.limit ?? 50

  const rows = db
    .prepare(`SELECT * FROM retrospectives ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as RetrospectiveRow[]

  return rows.map(rowToRetro)
}

export function updateRetrospectiveContent(id: number, content: string): Retrospective | null {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare('UPDATE retrospectives SET content = ?, updated_at = ? WHERE id = ?')
    .run(content, now, id)
  if (result.changes === 0) return null
  return getRetrospective(id)
}

export function deleteRetrospective(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM retrospectives WHERE id = ?').run(id)
  return result.changes > 0
}
