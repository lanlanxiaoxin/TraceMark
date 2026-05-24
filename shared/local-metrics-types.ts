/** 本地埋点事件名（仅写 SQLite，不上传）。 */
export type LocalMetricName =
  | 'page_visit'
  | 'asset_generated'
  | 'asset_confirmed'
  | 'asset_dismissed'
  | 'asset_private'
  | 'asset_split'
  | 'asset_merged'
  | 'asset_regenerated'
  | 'report_generated'
  | 'retro_generated'
  | 'today_seal_started'
  | 'today_seal_completed'
  | 'today_seal_skipped'
  | 'weekly_battle_opened'
  | 'weekly_battle_generated'
  | 'weekly_battle_exported'
  | 'weekly_memory_capsule_exported'
  | 'asset_search_triggered'
  | 'asset_search_hit'
  | 'asset_search_clicked'
  | 'asset_evidence_expanded'
  | 'asset_timeline_jumped'
  | 'self_check_logged'

export type AppPageMetric = 'today' | 'projects' | 'timeline' | 'reports' | 'settings'

export interface LocalMetricPayloadMap {
  page_visit: { page: AppPageMetric }
  asset_generated: { dayStart: number; suggestedCount: number; force?: boolean }
  asset_confirmed: { id: number; projectId?: number | null }
  asset_dismissed: { id: number }
  asset_private: { id: number }
  asset_split: { id: number; partsCount: number }
  asset_merged: { count: number; resultId?: number }
  asset_regenerated: { dayStart: number }
  report_generated: {
    kind: 'daily' | 'weekly'
    reportId: number
    mode: string
    dateStart: number
    source?: 'seal' | 'legacy' | 'battle'
    reportVersion?: string
  }
  retro_generated: {
    kind: 'weekly' | 'project_phase'
    projectId: number | null
    weekStartMs?: number
    dateStart?: number
    dateEnd?: number
    includedReportCount: number
  }
  today_seal_started: { dateMs: number }
  today_seal_completed: { dateMs: number; durationMs?: number }
  today_seal_skipped: { dateMs: number }
  weekly_battle_opened: { weekStartMs: number }
  weekly_battle_generated: { weekStartMs: number; mode?: string }
  weekly_battle_exported: { format: 'markdown' | 'image' }
  weekly_memory_capsule_exported: { weekStartMs: number }
  asset_search_triggered: { query: string }
  asset_search_hit: { query: string; hitCount: number }
  asset_search_clicked: { query: string; assetId: number }
  asset_evidence_expanded: { assetId: number }
  asset_timeline_jumped: { assetId: number; startedAt: number }
  self_check_logged: { reason: string }
}

export type LocalMetricPayload<N extends LocalMetricName> = LocalMetricPayloadMap[N]

export interface LocalMetricRow {
  id: number
  name: LocalMetricName
  payload: Record<string, unknown> | null
  createdAt: number
}

export interface ListLocalMetricsFilter {
  name?: LocalMetricName
  from?: number
  to?: number
  limit?: number
}

export interface ExportMetricsFilter {
  name?: LocalMetricName
  from?: number
  to?: number
  limit?: number
}

export interface DailyMetricAggregate {
  dateMs: number
  count: number
}

export interface NameMetricAggregate {
  name: string
  count: number
}

export const DEFAULT_METRICS_EXPORT_LIMIT = 10_000
