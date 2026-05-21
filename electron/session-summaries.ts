import { getDb } from './database'

export type SessionSourceType = 'git' | 'browser' | 'document' | 'meeting' | 'chat' | 'manual'
export type SessionSourceLevel = 'basic' | 'safe' | 'enhanced'

export interface SessionSummary {
  id: number
  projectId: number | null
  activityLogId: number | null
  processName: string | null
  sourceType: SessionSourceType
  summary: string
  sourceLevel: SessionSourceLevel
  createdAt: number
}

interface SessionSummaryRow {
  id: number
  project_id: number | null
  activity_log_id: number | null
  process_name: string | null
  source_type: string
  summary: string
  source_level: string
  created_at: number
}

function rowToSummary(row: SessionSummaryRow): SessionSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    activityLogId: row.activity_log_id,
    processName: row.process_name,
    sourceType: row.source_type as SessionSourceType,
    summary: row.summary,
    sourceLevel: row.source_level as SessionSourceLevel,
    createdAt: row.created_at
  }
}

export function createSessionSummary(input: {
  projectId?: number | null
  activityLogId?: number
  processName?: string
  sourceType: SessionSourceType
  summary: string
  sourceLevel?: SessionSourceLevel
}): SessionSummary {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(
      `INSERT INTO session_summaries (
        project_id, activity_log_id, process_name, source_type, summary, source_level, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.projectId ?? null,
      input.activityLogId ?? null,
      input.processName ?? null,
      input.sourceType,
      input.summary,
      input.sourceLevel ?? 'safe',
      now
    )
  const row = db.prepare('SELECT * FROM session_summaries WHERE id = ?').get(result.lastInsertRowid) as
    SessionSummaryRow
  return rowToSummary(row)
}

export function listSessionSummaries(projectId: number, limit = 50): SessionSummary[] {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT * FROM session_summaries WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(projectId, limit) as SessionSummaryRow[]
  return rows.map(rowToSummary)
}

export function listSessionSummariesInRange(
  projectId: number | null,
  startedAt: number,
  endedAt: number,
  limit = 30
): SessionSummary[] {
  const db = getDb()
  const rows = projectId != null
    ? (db
        .prepare(
          `SELECT * FROM session_summaries
           WHERE project_id = ? AND created_at >= ? AND created_at <= ?
           ORDER BY created_at DESC LIMIT ?`
        )
        .all(projectId, startedAt, endedAt, limit) as SessionSummaryRow[])
    : (db
        .prepare(
          `SELECT * FROM session_summaries
           WHERE project_id IS NULL AND created_at >= ? AND created_at <= ?
           ORDER BY created_at DESC LIMIT ?`
        )
        .all(startedAt, endedAt, limit) as SessionSummaryRow[])
  return rows.map(rowToSummary)
}
