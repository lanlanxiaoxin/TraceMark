import { getDb } from './database'
import { dayBounds } from './work-asset-generator'

export interface DailySealRecord {
  id: number
  dateMs: number
  projectId: number | null
  projectName: string | null
  parsedProjectLabel: string | null
  taskHint: string | null
  note: string
  skippedMainline: boolean
  evidenceSuggested: number
  evidenceArchived: number
  evidenceDismissed: number
  completedAt: number
  createdAt: number
  updatedAt: number
}

export interface UpsertDailySealInput {
  dateMs: number
  projectId?: number | null
  projectName?: string | null
  parsedProjectLabel?: string | null
  taskHint?: string | null
  note?: string
  skippedMainline?: boolean
  evidenceSuggested?: number
  evidenceArchived?: number
  evidenceDismissed?: number
  completedAt?: number
}

interface DailySealRow {
  id: number
  date_ms: number
  project_id: number | null
  project_name: string | null
  parsed_project_label: string | null
  task_hint: string | null
  note: string | null
  skipped_mainline: number
  evidence_suggested: number
  evidence_archived: number
  evidence_dismissed: number
  completed_at: number
  created_at: number
  updated_at: number
}

function rowToRecord(row: DailySealRow): DailySealRecord {
  return {
    id: row.id,
    dateMs: row.date_ms,
    projectId: row.project_id,
    projectName: row.project_name,
    parsedProjectLabel: row.parsed_project_label,
    taskHint: row.task_hint,
    note: row.note ?? '',
    skippedMainline: row.skipped_mainline === 1,
    evidenceSuggested: row.evidence_suggested,
    evidenceArchived: row.evidence_archived,
    evidenceDismissed: row.evidence_dismissed,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function dayStartMs(dateMs: number): number {
  const { start } = dayBounds(dateMs)
  return start
}

export function upsertDailySeal(input: UpsertDailySealInput): DailySealRecord {
  const db = getDb()
  const dateMs = dayStartMs(input.dateMs)
  const now = Date.now()
  const completedAt = input.completedAt ?? now

  const existing = db
    .prepare('SELECT id, created_at FROM daily_seals WHERE date_ms = ?')
    .get(dateMs) as { id: number; created_at: number } | undefined

  if (existing) {
    db.prepare(
      `UPDATE daily_seals SET
        project_id = ?,
        project_name = ?,
        parsed_project_label = ?,
        task_hint = ?,
        note = ?,
        skipped_mainline = ?,
        evidence_suggested = ?,
        evidence_archived = ?,
        evidence_dismissed = ?,
        completed_at = ?,
        updated_at = ?
      WHERE date_ms = ?`
    ).run(
      input.projectId ?? null,
      input.projectName ?? null,
      input.parsedProjectLabel ?? null,
      input.taskHint ?? null,
      input.note ?? '',
      input.skippedMainline ? 1 : 0,
      input.evidenceSuggested ?? 0,
      input.evidenceArchived ?? 0,
      input.evidenceDismissed ?? 0,
      completedAt,
      now,
      dateMs
    )
    const row = db.prepare('SELECT * FROM daily_seals WHERE date_ms = ?').get(dateMs) as DailySealRow
    return rowToRecord(row)
  }

  const result = db
    .prepare(
      `INSERT INTO daily_seals (
        date_ms, project_id, project_name, parsed_project_label, task_hint, note,
        skipped_mainline, evidence_suggested, evidence_archived, evidence_dismissed,
        completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      dateMs,
      input.projectId ?? null,
      input.projectName ?? null,
      input.parsedProjectLabel ?? null,
      input.taskHint ?? null,
      input.note ?? '',
      input.skippedMainline ? 1 : 0,
      input.evidenceSuggested ?? 0,
      input.evidenceArchived ?? 0,
      input.evidenceDismissed ?? 0,
      completedAt,
      now,
      now
    )

  const row = db.prepare('SELECT * FROM daily_seals WHERE id = ?').get(result.lastInsertRowid) as DailySealRow
  return rowToRecord(row)
}

export function getDailySeal(dateMs: number): DailySealRecord | null {
  const db = getDb()
  const key = dayStartMs(dateMs)
  const row = db.prepare('SELECT * FROM daily_seals WHERE date_ms = ?').get(key) as DailySealRow | undefined
  return row ? rowToRecord(row) : null
}

export function listDailySealsBetween(dateStartMs: number, dateEndMs: number): DailySealRecord[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM daily_seals WHERE date_ms >= ? AND date_ms <= ? ORDER BY date_ms ASC`
    )
    .all(dateStartMs, dateEndMs) as DailySealRow[]
  return rows.map(rowToRecord)
}
