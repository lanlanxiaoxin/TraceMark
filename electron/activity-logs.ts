import { getDb } from './database'
import type { ActivityCategory } from './window-title-parser'

export interface ActivityLogRow {
  id: number
  process_name: string
  window_title: string | null
  executable_path: string | null
  started_at: number
  ended_at: number
  category: string | null
  parsed_project: string | null
  parsed_file: string | null
  sanitized_title: string | null
  enrichment_source: string | null
  is_important: number
  user_note: string | null
  is_deleted: number
}

export interface ParsedActivityFields {
  category: ActivityCategory
  parsedProject: string | null
  parsedFile: string | null
  sanitizedTitle: string
}

export interface ListActivityLogsOptions {
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}

export function upsertActivitySnapshot(
  processName: string,
  windowTitle: string,
  executablePath: string,
  parsed: ParsedActivityFields,
  now: number,
  openSegmentId: number | null
): number {
  const db = getDb()

  if (openSegmentId != null) {
    const open = db
      .prepare(
        `SELECT id, process_name, window_title, category, parsed_project, parsed_file
         FROM activity_logs WHERE id = ? AND is_deleted = 0`
      )
      .get(openSegmentId) as
      | {
          id: number
          process_name: string
          window_title: string | null
          category: string | null
          parsed_project: string | null
          parsed_file: string | null
        }
      | undefined

    if (
      open &&
      open.process_name === processName &&
      (open.window_title ?? '') === windowTitle &&
      (open.category ?? '') === parsed.category &&
      (open.parsed_project ?? '') === (parsed.parsedProject ?? '') &&
      (open.parsed_file ?? '') === (parsed.parsedFile ?? '')
    ) {
      db.prepare('UPDATE activity_logs SET ended_at = ? WHERE id = ?').run(now, open.id)
      return open.id
    }
  }

  const result = db
    .prepare(
      `INSERT INTO activity_logs
       (process_name, window_title, executable_path, started_at, ended_at,
        category, parsed_project, parsed_file, sanitized_title)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      processName,
      windowTitle || null,
      executablePath || null,
      now,
      now,
      parsed.category,
      parsed.parsedProject,
      parsed.parsedFile,
      parsed.sanitizedTitle
    )

  return Number(result.lastInsertRowid)
}

export function updateActivityField(
  id: number,
  field: 'is_important' | 'user_note' | 'is_deleted',
  value: number | string
): void {
  const db = getDb()
  db.prepare(`UPDATE activity_logs SET ${field} = ? WHERE id = ?`).run(value, id)
}

export function listActivityLogs(options: ListActivityLogsOptions = {}): {
  items: ActivityLogRow[]
  total: number
} {
  const db = getDb()
  const { startTime, endTime, limit = 50, offset = 0 } = options

  const conditions = ['is_deleted = 0']
  const params: number[] = []

  if (startTime != null) {
    conditions.push('started_at >= ?')
    params.push(startTime)
  }
  if (endTime != null) {
    conditions.push('started_at <= ?')
    params.push(endTime)
  }

  const where = conditions.join(' AND ')
  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM activity_logs WHERE ${where}`)
    .get(...params) as { cnt: number }

  const items = db
    .prepare(
      `SELECT * FROM activity_logs WHERE ${where}
       ORDER BY started_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as ActivityLogRow[]

  return { items, total: totalRow.cnt }
}
