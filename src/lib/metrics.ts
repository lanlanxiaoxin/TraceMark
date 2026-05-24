/** 本地 SQLite 埋点（不上传）。 */
import type {
  DailyMetricAggregate,
  ExportMetricsFilter,
  ListLocalMetricsFilter,
  LocalMetricName,
  LocalMetricPayload,
  LocalMetricRow,
  NameMetricAggregate
} from '../../shared/local-metrics-types'

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
} from '../../shared/local-metrics-types'

export { DEFAULT_METRICS_EXPORT_LIMIT } from '../../shared/local-metrics-types'

export async function recordMetric<N extends LocalMetricName>(
  name: N,
  payload?: LocalMetricPayload<N>
): Promise<boolean> {
  return window.electronAPI.recordMetric(name, payload)
}

export async function countMetrics(name?: LocalMetricName): Promise<number> {
  return window.electronAPI.countMetrics(name)
}

export async function listMetrics(filter?: ListLocalMetricsFilter): Promise<LocalMetricRow[]> {
  return window.electronAPI.listMetrics(filter)
}

export async function aggregateMetricsByDay(
  name: LocalMetricName,
  from: number,
  to: number
): Promise<DailyMetricAggregate[]> {
  return window.electronAPI.aggregateMetricsByDay(name, from, to)
}

export async function aggregateMetricsByName(
  from: number,
  to: number
): Promise<NameMetricAggregate[]> {
  return window.electronAPI.aggregateMetricsByName(from, to)
}

export async function exportMetricsJson(filter?: ExportMetricsFilter): Promise<string> {
  return window.electronAPI.exportMetricsJson(filter)
}
