import { getDb } from './database'
import {
  aggregateMetricsByDayFromRows,
  aggregateMetricsByNameFromRows
} from '../shared/local-metrics-aggregate'
import type {
  DailyMetricAggregate,
  ExportMetricsFilter,
  ListLocalMetricsFilter,
  LocalMetricName,
  LocalMetricPayload,
  LocalMetricRow,
  NameMetricAggregate
} from '../shared/local-metrics-types'
import { DEFAULT_METRICS_EXPORT_LIMIT } from '../shared/local-metrics-types'

export type {
  AppPageMetric,
  DailyMetricAggregate,
  ExportMetricsFilter,
  ListLocalMetricsFilter,
  LocalMetricName,
  LocalMetricPayload,
  LocalMetricPayloadMap,
  LocalMetricRow,
  NameMetricAggregate
} from '../shared/local-metrics-types'

export { DEFAULT_METRICS_EXPORT_LIMIT } from '../shared/local-metrics-types'

interface DbMetricRow {
  id: number
  name: string
  payload_json: string | null
  created_at: number
}

function mapDbRow(row: DbMetricRow): LocalMetricRow {
  let payload: Record<string, unknown> | null = null
  if (row.payload_json) {
    try {
      payload = JSON.parse(row.payload_json) as Record<string, unknown>
    } catch {
      payload = null
    }
  }
  return {
    id: row.id,
    name: row.name as LocalMetricName,
    payload,
    createdAt: row.created_at
  }
}

export function recordLocalMetric<N extends LocalMetricName>(
  name: N,
  payload?: LocalMetricPayload<N>
): void {
  const db = getDb()
  const json =
    payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : null
  db.prepare(
    `INSERT INTO local_metrics (name, payload_json, created_at) VALUES (?, ?, ?)`
  ).run(name, json, Date.now())
}

export function countLocalMetrics(name?: LocalMetricName | null): number {
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

export function listLocalMetrics(filter: ListLocalMetricsFilter = {}): LocalMetricRow[] {
  const db = getDb()
  const clauses: string[] = []
  const params: Array<string | number> = []

  if (filter.name) {
    clauses.push('name = ?')
    params.push(filter.name)
  }
  if (filter.from !== undefined) {
    clauses.push('created_at >= ?')
    params.push(filter.from)
  }
  if (filter.to !== undefined) {
    clauses.push('created_at <= ?')
    params.push(filter.to)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = filter.limit ?? DEFAULT_METRICS_EXPORT_LIMIT
  const sql = `
    SELECT id, name, payload_json, created_at
    FROM local_metrics
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `
  const rows = db.prepare(sql).all(...params, limit) as DbMetricRow[]
  return rows.map(mapDbRow)
}

function listAggregateSourceRows(
  name: LocalMetricName | undefined,
  from: number,
  to: number
): Array<{ name: string; created_at: number }> {
  const db = getDb()
  const clauses = ['created_at >= ?', 'created_at <= ?']
  const params: Array<string | number> = [from, to]
  if (name) {
    clauses.push('name = ?')
    params.push(name)
  }
  const sql = `
    SELECT name, created_at
    FROM local_metrics
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at ASC
  `
  return db.prepare(sql).all(...params) as Array<{ name: string; created_at: number }>
}

export function aggregateByDay(
  name: LocalMetricName,
  from: number,
  to: number
): DailyMetricAggregate[] {
  const rows = listAggregateSourceRows(name, from, to)
  return aggregateMetricsByDayFromRows(rows, name, from, to)
}

export function aggregateByName(from: number, to: number): NameMetricAggregate[] {
  const rows = listAggregateSourceRows(undefined, from, to)
  return aggregateMetricsByNameFromRows(rows, from, to)
}

export function exportMetricsAsJson(filter: ExportMetricsFilter = {}): string {
  const limit = filter.limit ?? DEFAULT_METRICS_EXPORT_LIMIT
  const rows = listLocalMetrics({ ...filter, limit })
  return JSON.stringify(
    {
      exportedAt: Date.now(),
      count: rows.length,
      items: rows
    },
    null,
    2
  )
}
