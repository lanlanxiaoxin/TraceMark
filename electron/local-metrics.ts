import { getDb } from './database'

/** 本地埋点事件名（仅写 SQLite，不上传）。 */
export type LocalMetricName =
  | 'page_visit'
  | 'asset_generated'
  | 'asset_confirmed'
  | 'asset_dismissed'
  | 'asset_private'
  | 'retro_generated'
  | 'report_generated'

export function recordLocalMetric(name: LocalMetricName | string, payload?: Record<string, unknown>): void {
  const db = getDb()
  const json =
    payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : null
  db.prepare(
    `INSERT INTO local_metrics (name, payload_json, created_at) VALUES (?, ?, ?)`
  ).run(name, json, Date.now())
}

export function countLocalMetrics(name?: string | null): number {
  const db = getDb()
  const key = name?.trim()
  if (key) {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM local_metrics WHERE name = ?`).get(key) as
      | { c: number }
      | undefined
    return row?.c ?? 0
  }
  const row = db.prepare(`SELECT COUNT(*) AS c FROM local_metrics`).get() as { c: number } | undefined
  return row?.c ?? 0
}
