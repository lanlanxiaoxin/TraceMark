import type { DailyMetricAggregate, NameMetricAggregate } from './local-metrics-types'

export interface MetricAggregateRow {
  name: string
  created_at: number
}

export function startOfLocalDayMs(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function aggregateMetricsByDayFromRows(
  rows: MetricAggregateRow[],
  name: string,
  from: number,
  to: number
): DailyMetricAggregate[] {
  const counts = new Map<number, number>()
  for (const row of rows) {
    if (row.name !== name) continue
    if (row.created_at < from || row.created_at > to) continue
    const day = startOfLocalDayMs(row.created_at)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([dateMs, count]) => ({ dateMs, count }))
    .sort((a, b) => a.dateMs - b.dateMs)
}

export function aggregateMetricsByNameFromRows(
  rows: MetricAggregateRow[],
  from: number,
  to: number
): NameMetricAggregate[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.created_at < from || row.created_at > to) continue
    counts.set(row.name, (counts.get(row.name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
