import { contextBridge, ipcRenderer } from 'electron'

interface ListActivityLogsOptions {
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}

interface GenerateReportResult {
  id: number
  content: string
  mode: 'ai' | 'offline'
  degradedFromAi?: boolean
  degradationReason?: string
}

const api = {
  getSettings: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('settings:getAll'),
  getSetting: (key: string): Promise<string | null> =>
    ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string): Promise<boolean> =>
    ipcRenderer.invoke('settings:set', key, value),
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:getVersion'),
  openExternalUrl: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:openExternal', url),
  recordMetric: <N extends import('../shared/local-metrics-types').LocalMetricName>(
    name: N,
    payload?: import('../shared/local-metrics-types').LocalMetricPayload<N>
  ): Promise<boolean> => ipcRenderer.invoke('metrics:record', name, payload),
  countMetrics: (
    name?: import('../shared/local-metrics-types').LocalMetricName
  ): Promise<number> => ipcRenderer.invoke('metrics:count', name),
  listMetrics: (
    filter?: import('../shared/local-metrics-types').ListLocalMetricsFilter
  ): Promise<import('../shared/local-metrics-types').LocalMetricRow[]> =>
    ipcRenderer.invoke('metrics:list', filter),
  aggregateMetricsByDay: (
    name: import('../shared/local-metrics-types').LocalMetricName,
    from: number,
    to: number
  ): Promise<import('../shared/local-metrics-types').DailyMetricAggregate[]> =>
    ipcRenderer.invoke('metrics:aggregateByDay', name, from, to),
  aggregateMetricsByName: (
    from: number,
    to: number
  ): Promise<import('../shared/local-metrics-types').NameMetricAggregate[]> =>
    ipcRenderer.invoke('metrics:aggregateByName', from, to),
  exportMetricsJson: (
    filter?: import('../shared/local-metrics-types').ExportMetricsFilter
  ): Promise<string> => ipcRenderer.invoke('metrics:exportJson', filter),
  suggestTodayMainline: (dateMs: number): Promise<unknown> =>
    ipcRenderer.invoke('todaySeal:suggestMainline', dateMs),
  getDailySeal: (dateMs: number): Promise<unknown> =>
    ipcRenderer.invoke('dailySeal:get', dateMs),
  upsertDailySeal: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('dailySeal:upsert', input),
  getDailyNarrative: (dateMs: number): Promise<string> =>
    ipcRenderer.invoke('dailyNarrative:get', dateMs),
  buildDailyNarrativeUploadPreview: (dateMs: number): Promise<unknown> =>
    ipcRenderer.invoke('uploadPreview:dailyNarrative', dateMs),
  generateDailyNarrativeAi: (dateMs: number): Promise<unknown> =>
    ipcRenderer.invoke('dailyNarrative:generateAi', dateMs),
  listActivityLogs: (options: ListActivityLogsOptions): Promise<unknown> =>
    ipcRenderer.invoke('activityLogs:list', options),
  markActivityImportant: (id: number, important: boolean): Promise<boolean> =>
    ipcRenderer.invoke('activityLogs:markImportant', id, important),
  addActivityNote: (id: number, note: string): Promise<boolean> =>
    ipcRenderer.invoke('activityLogs:addNote', id, note),
  softDeleteActivity: (id: number): Promise<boolean> =>
    ipcRenderer.invoke('activityLogs:softDelete', id),
  onActivityLogsUpdated: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('activity-logs:updated', handler)
    return () => ipcRenderer.removeListener('activity-logs:updated', handler)
  },
  getActivityProviderStatus: (): Promise<unknown> =>
    ipcRenderer.invoke('activity:getProviderStatus'),
  requestActivityPermissions: (): Promise<{ granted: boolean; message?: string }> =>
    ipcRenderer.invoke('activity:requestPermissions'),
  generateDailyReport: (dateMs: number): Promise<GenerateReportResult> =>
    ipcRenderer.invoke('reports:generateDaily', dateMs),
  generateWeeklyReport: (weekStartMs: number): Promise<GenerateReportResult> =>
    ipcRenderer.invoke('reports:generateWeekly', weekStartMs),
  getLatestReport: (type: 'daily' | 'weekly'): Promise<unknown> =>
    ipcRenderer.invoke('reports:getLatest', type),
  getReportForPeriod: (payload: {
    type: 'daily' | 'weekly'
    dateStart: number
    dateEnd: number
  }): Promise<unknown> => ipcRenderer.invoke('reports:getForPeriod', payload),
  listReportsInRange: (payload: {
    dateStart: number
    dateEnd: number
    types?: Array<'daily' | 'weekly'>
    limit?: number
  }): Promise<unknown> => ipcRenderer.invoke('reports:listInRange', payload),
  exportMarkdown: (content: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('reports:exportMarkdown', content, defaultName),
  saveReportPng: (dataUrl: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('reports:savePng', dataUrl, defaultName),
  getWeeklyMemoryCapsule: (weekStartMs: number): Promise<unknown> =>
    ipcRenderer.invoke('reports:weeklyMemoryCapsule', weekStartMs),
  onAppNavigate: (
    callback: (payload: {
      page: 'reports'
      intent: { type?: 'daily' | 'weekly'; dateMs?: number; autoGenerate?: boolean }
    }) => void
  ): (() => void) => {
    const handler = (
      _event: unknown,
      payload: {
        page: 'reports'
        intent: { type?: 'daily' | 'weekly'; dateMs?: number; autoGenerate?: boolean }
      }
    ): void => callback(payload)
    ipcRenderer.on('app:navigate', handler)
    return () => ipcRenderer.removeListener('app:navigate', handler)
  },
  getDefaultProcessCategories: (): Promise<{
    mapping: Record<string, string[]>
    labels: Record<string, string>
  }> => ipcRenderer.invoke('settings:getDefaultProcessCategories'),

  listProjectSpaces: (): Promise<unknown> => ipcRenderer.invoke('projectSpaces:list'),
  getProjectSpace: (id: number): Promise<unknown> => ipcRenderer.invoke('projectSpaces:get', id),
  createProjectSpace: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('projectSpaces:create', input),
  updateProjectSpace: (id: number, patch: unknown): Promise<unknown> =>
    ipcRenderer.invoke('projectSpaces:update', id, patch),
  deleteProjectSpace: (id: number): Promise<boolean> =>
    ipcRenderer.invoke('projectSpaces:delete', id),
  listProjectAliases: (projectId: number): Promise<unknown> =>
    ipcRenderer.invoke('projectSpaces:listAliases', projectId),
  replaceProjectAliases: (projectId: number, aliases: unknown): Promise<unknown> =>
    ipcRenderer.invoke('projectSpaces:replaceAliases', projectId, aliases),
  addProjectAlias: (
    projectId: number,
    aliasType: string,
    value: string,
    alias?: string
  ): Promise<unknown> =>
    ipcRenderer.invoke('projectSpaces:addAlias', projectId, aliasType, value, alias),

  listWorkAssets: (filter: unknown): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:list', filter),
  searchWorkAssetsRecall: (
    query: string,
    options?: { limit?: number; rerank?: boolean; activityLimit?: number }
  ): Promise<unknown> => ipcRenderer.invoke('workAssets:searchRecall', query, options),
  getWorkAsset: (id: number): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:get', id),
  updateWorkAsset: (id: number, patch: unknown): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:update', id, patch),
  generateSuggestedAssets: (dateMs: number, force?: boolean): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:generateSuggested', dateMs, force),
  onWorkAssetsUpdated: (callback: (payload: unknown) => void): (() => void) => {
    const handler = (_event: unknown, payload: unknown): void => callback(payload)
    ipcRenderer.on('work-assets:updated', handler)
    return () => ipcRenderer.removeListener('work-assets:updated', handler)
  },
  confirmWorkAsset: (id: number, patch?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:confirm', id, patch),
  ignoreWorkAsset: (id: number): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:ignore', id),
  markPrivateWorkAsset: (id: number): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:markPrivate', id),
  mergeWorkAssets: (ids: number[]): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:merge', ids),
  splitWorkAsset: (id: number, parts: unknown): Promise<unknown> =>
    ipcRenderer.invoke('workAssets:split', id, parts),
  exportContent: (content: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('content:export', content, defaultName),
  buildRetroWeeklyPreview: (projectId: number | null, weekStartMs: number): Promise<unknown> =>
    ipcRenderer.invoke('uploadPreview:retroWeekly', projectId, weekStartMs),
  buildRetroPhasePreview: (
    projectId: number,
    dateStart: number,
    dateEnd: number
  ): Promise<unknown> =>
    ipcRenderer.invoke('uploadPreview:retroPhase', projectId, dateStart, dateEnd),
  buildSealDailyReportUploadPreview: (dateMs: number): Promise<unknown> =>
    ipcRenderer.invoke('uploadPreview:sealDailyReport', dateMs),
  buildActivityReportPreview: (dateStart: number, dateEnd: number): Promise<unknown> =>
    ipcRenderer.invoke('uploadPreview:activityReport', dateStart, dateEnd),
  countWorkAssetsByProject: (projectId: number): Promise<number> =>
    ipcRenderer.invoke('workAssets:countByProject', projectId),

  listRetrospectives: (filter?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('retrospectives:list', filter),
  getRetrospective: (id: number): Promise<unknown> =>
    ipcRenderer.invoke('retrospectives:get', id),
  saveRetrospective: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('retrospectives:save', input),
  deleteRetrospective: (id: number): Promise<boolean> =>
    ipcRenderer.invoke('retrospectives:delete', id),
  generateWeeklyRetro: (
    projectId: number | null,
    weekStartMs: number,
    extra?: { includeReportIds?: number[] }
  ): Promise<unknown> =>
    ipcRenderer.invoke('retrospectives:generateWeekly', projectId, weekStartMs, extra),
  generateProjectPhaseRetro: (
    projectId: number,
    dateStart: number,
    dateEnd: number,
    extra?: { includeReportIds?: number[] }
  ): Promise<unknown> =>
    ipcRenderer.invoke('retrospectives:generatePhase', projectId, dateStart, dateEnd, extra),

  getPrivacyConsent: (
    scopeType: string,
    scopeId: string | null,
    capability: string
  ): Promise<unknown> =>
    ipcRenderer.invoke('privacyConsents:get', scopeType, scopeId, capability),
  setPrivacyConsent: (
    scopeType: string,
    scopeId: string | null,
    capability: string,
    enabled: boolean
  ): Promise<unknown> =>
    ipcRenderer.invoke('privacyConsents:set', scopeType, scopeId, capability, enabled),

  pickDirectory: (options?: {
    defaultPath?: string
    title?: string
    multiple?: boolean
  }): Promise<string | string[] | null> => ipcRenderer.invoke('dialog:pickDirectory', options)
}

contextBridge.exposeInMainWorld('electronAPI', api)
