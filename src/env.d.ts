/// <reference types="vite/client" />

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

export type ActivityCategory =
  | 'code_editor'
  | 'terminal'
  | 'browser'
  | 'design'
  | 'docs'
  | 'communication'
  | 'meeting'
  | 'file_manager'
  | 'other'

export interface ActivityLog {
  id: number
  process_name: string
  window_title: string | null
  executable_path: string | null
  started_at: number
  ended_at: number
  category: ActivityCategory | null
  parsed_project: string | null
  parsed_file: string | null
  sanitized_title: string | null
  enrichment_source: string | null
  is_important: number
  user_note: string | null
  is_deleted: number
}

export interface ListActivityLogsOptions {
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}

export interface ListActivityLogsResult {
  items: ActivityLog[]
  total: number
}

export interface GenerateReportResult {
  id: number
  content: string
  mode: 'ai' | 'offline'
  degradedFromAi?: boolean
  degradationReason?: string
  source?: 'seal' | 'legacy' | 'battle'
  reportVersion?: 'v3' | 'v2' | 'battle-v3'
}

export interface AppNavigatePayload {
  page: 'reports'
  intent: {
    type?: 'daily' | 'weekly'
    dateMs?: number
    autoGenerate?: boolean
  }
}

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

export interface DailyNarrativeAiResult {
  content: string
  mode: 'ai' | 'offline'
  degradedFromAi?: boolean
  degradationReason?: string
}

export interface StoredReport {
  id: number
  content: string
  date_start: number
  date_end: number
  created_at: number
}

export interface StoredReportSummary {
  id: number
  type: 'daily' | 'weekly'
  content: string
  date_start: number
  date_end: number
  created_at: number
}

export type ProjectRoleTemplate = 'developer' | 'pm' | 'implementation' | 'office'
export type ProjectAliasType = 'name' | 'repo' | 'browser' | 'document' | 'meeting' | 'chat'
export type AssetKind = 'outcome' | 'process' | 'evidence'
export type AssetStatus = 'suggested' | 'confirmed' | 'ignored' | 'private'
export type AssetConfidence = 'high' | 'medium' | 'low'

export interface TodayMainlineSuggestion {
  projectId: number | null
  projectName: string | null
  parsedProjectLabel: string | null
  taskHint: string | null
  activityMinutes: number
  confidence: 'high' | 'low'
}

export interface ProjectSpace {
  id: number
  name: string
  privacyAlias: string | null
  description: string | null
  roleTemplate: ProjectRoleTemplate | null
  createdAt: number
  updatedAt: number
}

export interface ProjectAlias {
  id: number
  projectId: number
  alias: string
  aliasType: ProjectAliasType
  value: string
  createdAt: number
}

export interface EvidenceItem {
  type: string
  summary: string
  activityLogId?: number
  startedAt?: number
  endedAt?: number
  metadata?: Record<string, unknown>
}

export interface WorkAsset {
  id: number
  projectId: number | null
  title: string
  assetKind: AssetKind
  assetType: string
  description: string | null
  impact: string | null
  confidence: AssetConfidence
  status: AssetStatus
  privacyLevel: string
  startedAt: number | null
  endedAt: number | null
  evidence: EvidenceItem[]
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface WorkAssetFilter {
  projectId?: number | null
  status?: AssetStatus | AssetStatus[]
  assetKind?: AssetKind | AssetKind[]
  search?: string
  dateStart?: number
  dateEnd?: number
  limit?: number
  offset?: number
}

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

export interface RecallSearchResult {
  items: WorkAsset[]
  activities: ActivityRecallHit[]
  parsed: {
    text: string
    dateStart?: number
    dateEnd?: number
    assetKind?: AssetKind
  }
  usedFts: boolean
  activityUsedFts: boolean
  reranked: boolean
}

export interface TimelineIntent {
  dayTimestamp?: number
  highlightActivityLogId?: number
  focusStartedAt?: number
}

export interface WeeklyMemoryCapsuleSection {
  title: string
  items: string[]
}

export interface WeeklyMemoryCapsulePayload {
  weekLabel: string
  weekStartMs: number
  stats: {
    assetCount: number
    sealCount: number
    outcomeCount: number
  }
  statsSubtitle: string
  sections: WeeklyMemoryCapsuleSection[]
}

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

export interface GenerateRetroResult {
  content: string
  mode: 'ai' | 'offline'
  sourceAssetIds: number[]
  sourceReportIds: number[]
  degradedFromAi?: boolean
  degradationReason?: string
}

export type UploadPreviewLineKind = 'info' | 'warning' | 'blocked'

export interface UploadPreviewLine {
  kind: UploadPreviewLineKind
  text: string
}

export interface UploadPreview {
  title: string
  lines: UploadPreviewLine[]
  payloadSummary: string
  canProceed: boolean
  requiresConsent: boolean
}

export interface SplitWorkAssetPart {
  title: string
  assetKind: AssetKind
  description?: string
  evidence?: EvidenceItem[]
}

export interface CreateProjectSpaceInput {
  name: string
  privacyAlias?: string
  description?: string
  roleTemplate?: ProjectRoleTemplate
}

export interface UpdateProjectSpaceInput {
  name?: string
  privacyAlias?: string | null
  description?: string | null
  roleTemplate?: ProjectRoleTemplate | null
}

export interface UpdateWorkAssetPatch {
  title?: string
  assetKind?: AssetKind
  assetType?: string
  description?: string | null
  impact?: string | null
  confidence?: AssetConfidence
  status?: AssetStatus
  projectId?: number | null
  tags?: string[]
  evidence?: EvidenceItem[]
  startedAt?: number | null
  endedAt?: number | null
}

export type GenerateSuggestedResult =
  | { status: 'ready'; count: number; items: WorkAsset[] }
  | { status: 'generating' }

export interface WorkAssetsUpdatedPayload {
  dateMs: number
  suggested: WorkAsset[]
  confirmed: WorkAsset[]
  count: number
}

export interface ActivityProviderStatus {
  platform: 'win32' | 'darwin' | 'linux'
  available: boolean
  label: string
  explainPermissions: string
}

interface ElectronAPI {
  getSettings: () => Promise<Record<string, string>>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<boolean>
  getAppVersion: () => Promise<string>
  openExternalUrl: (url: string) => Promise<boolean>
  recordMetric: <N extends import('../shared/local-metrics-types').LocalMetricName>(
    name: N,
    payload?: import('../shared/local-metrics-types').LocalMetricPayload<N>
  ) => Promise<boolean>
  countMetrics: (
    name?: import('../shared/local-metrics-types').LocalMetricName
  ) => Promise<number>
  listMetrics: (
    filter?: import('../shared/local-metrics-types').ListLocalMetricsFilter
  ) => Promise<import('../shared/local-metrics-types').LocalMetricRow[]>
  aggregateMetricsByDay: (
    name: import('../shared/local-metrics-types').LocalMetricName,
    from: number,
    to: number
  ) => Promise<import('../shared/local-metrics-types').DailyMetricAggregate[]>
  aggregateMetricsByName: (
    from: number,
    to: number
  ) => Promise<import('../shared/local-metrics-types').NameMetricAggregate[]>
  exportMetricsJson: (
    filter?: import('../shared/local-metrics-types').ExportMetricsFilter
  ) => Promise<string>
  suggestTodayMainline: (dateMs: number) => Promise<TodayMainlineSuggestion>
  getDailySeal: (dateMs: number) => Promise<DailySealRecord | null>
  upsertDailySeal: (input: UpsertDailySealInput) => Promise<DailySealRecord>
  getDailyNarrative: (dateMs: number) => Promise<string>
  buildSealDailyReportUploadPreview: (dateMs: number) => Promise<UploadPreview>
  buildDailyNarrativeUploadPreview: (dateMs: number) => Promise<UploadPreview>
  generateDailyNarrativeAi: (dateMs: number) => Promise<DailyNarrativeAiResult>
  listActivityLogs: (options: ListActivityLogsOptions) => Promise<ListActivityLogsResult>
  markActivityImportant: (id: number, important: boolean) => Promise<boolean>
  addActivityNote: (id: number, note: string) => Promise<boolean>
  softDeleteActivity: (id: number) => Promise<boolean>
  onActivityLogsUpdated: (callback: () => void) => () => void
  getActivityProviderStatus: () => Promise<ActivityProviderStatus>
  requestActivityPermissions: () => Promise<{ granted: boolean; message?: string }>
  generateDailyReport: (dateMs: number) => Promise<GenerateReportResult>
  generateWeeklyReport: (weekStartMs: number) => Promise<GenerateReportResult>
  getLatestReport: (type: 'daily' | 'weekly') => Promise<StoredReport | null>
  getReportForPeriod: (payload: {
    type: 'daily' | 'weekly'
    dateStart: number
    dateEnd: number
  }) => Promise<StoredReport | null>
  listReportsInRange: (payload: {
    dateStart: number
    dateEnd: number
    types?: Array<'daily' | 'weekly'>
    limit?: number
  }) => Promise<StoredReportSummary[]>
  exportMarkdown: (content: string, defaultName: string) => Promise<boolean>
  saveReportPng: (dataUrl: string, defaultName: string) => Promise<boolean>
  getWeeklyMemoryCapsule: (weekStartMs: number) => Promise<WeeklyMemoryCapsulePayload>
  onAppNavigate: (callback: (payload: AppNavigatePayload) => void) => () => void
  pickDirectory: (options?: {
    defaultPath?: string
    title?: string
    multiple?: boolean
  }) => Promise<string | string[] | null>
  getDefaultProcessCategories: () => Promise<{
    mapping: Record<string, string[]>
    labels: Record<string, string>
  }>
  listProjectSpaces: () => Promise<ProjectSpace[]>
  getProjectSpace: (id: number) => Promise<ProjectSpace | null>
  createProjectSpace: (input: CreateProjectSpaceInput) => Promise<ProjectSpace>
  updateProjectSpace: (id: number, patch: UpdateProjectSpaceInput) => Promise<ProjectSpace | null>
  deleteProjectSpace: (id: number) => Promise<boolean>
  listProjectAliases: (projectId: number) => Promise<ProjectAlias[]>
  replaceProjectAliases: (
    projectId: number,
    aliases: Array<{ aliasType: ProjectAliasType; value: string; alias?: string }>
  ) => Promise<ProjectAlias[]>
  addProjectAlias: (
    projectId: number,
    aliasType: ProjectAliasType,
    value: string,
    alias?: string
  ) => Promise<ProjectAlias>
  listWorkAssets: (filter: WorkAssetFilter) => Promise<WorkAsset[]>
  searchWorkAssetsRecall: (
    query: string,
    options?: { limit?: number; rerank?: boolean; activityLimit?: number }
  ) => Promise<RecallSearchResult>
  getWorkAsset: (id: number) => Promise<WorkAsset | null>
  updateWorkAsset: (id: number, patch: UpdateWorkAssetPatch) => Promise<WorkAsset | null>
  generateSuggestedAssets: (dateMs: number, force?: boolean) => Promise<GenerateSuggestedResult>
  onWorkAssetsUpdated: (callback: (payload: WorkAssetsUpdatedPayload) => void) => () => void
  confirmWorkAsset: (id: number, patch?: UpdateWorkAssetPatch) => Promise<WorkAsset | null>
  ignoreWorkAsset: (id: number) => Promise<WorkAsset | null>
  markPrivateWorkAsset: (id: number) => Promise<WorkAsset | null>
  mergeWorkAssets: (ids: number[]) => Promise<WorkAsset | null>
  splitWorkAsset: (id: number, parts: SplitWorkAssetPart[]) => Promise<WorkAsset[]>
  exportContent: (content: string, defaultName: string) => Promise<boolean>
  buildRetroWeeklyPreview: (
    projectId: number | null,
    weekStartMs: number
  ) => Promise<UploadPreview>
  buildRetroPhasePreview: (
    projectId: number,
    dateStart: number,
    dateEnd: number
  ) => Promise<UploadPreview>
  buildActivityReportPreview: (dateStart: number, dateEnd: number) => Promise<UploadPreview>
  countWorkAssetsByProject: (projectId: number) => Promise<number>
  listRetrospectives: (filter?: RetrospectiveFilter) => Promise<Retrospective[]>
  getRetrospective: (id: number) => Promise<Retrospective | null>
  saveRetrospective: (input: CreateRetrospectiveInput) => Promise<Retrospective>
  deleteRetrospective: (id: number) => Promise<boolean>
  generateWeeklyRetro: (
    projectId: number | null,
    weekStartMs: number,
    extra?: { includeReportIds?: number[] }
  ) => Promise<GenerateRetroResult>
  generateProjectPhaseRetro: (
    projectId: number,
    dateStart: number,
    dateEnd: number,
    extra?: { includeReportIds?: number[] }
  ) => Promise<GenerateRetroResult>
  getPrivacyConsent: (
    scopeType: string,
    scopeId: string | null,
    capability: string
  ) => Promise<{ enabled: boolean } | null>
  setPrivacyConsent: (
    scopeType: string,
    scopeId: string | null,
    capability: string,
    enabled: boolean
  ) => Promise<unknown>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
