import { ipcMain, app, dialog, type BrowserWindow } from 'electron'
import { getDb } from './database'
import { listActivityLogs, updateActivityField } from './activity-logs'
import { reloadProcessWatcherFromSettings } from './process-watcher'
import { DEFAULT_PROCESS_CATEGORIES, CATEGORY_LABELS } from './window-title-parser'
import {
  generateDailyReport,
  generateWeeklyReport,
  saveReport,
  getLatestReport,
  getReportForPeriod,
  listReportsInRange
} from './ai-gateway'
import { writeFileSync } from 'fs'
import {
  listProjectSpaces,
  getProjectSpace,
  createProjectSpace,
  updateProjectSpace,
  deleteProjectSpace,
  addProjectAlias,
  listProjectAliases,
  replaceProjectAliases,
  type CreateProjectSpaceInput,
  type UpdateProjectSpaceInput,
  type ProjectAliasType
} from './project-spaces'
import {
  listWorkAssets,
  getWorkAsset,
  updateWorkAsset,
  mergeWorkAssets,
  splitWorkAsset,
  countWorkAssetsByProject,
  type WorkAssetFilter,
  type UpdateWorkAssetPatch,
  type SplitWorkAssetPart
} from './work-assets'
import { listSuggestedForDay } from './work-asset-generator'
import { scheduleGenerateSuggestedAssets } from './work-asset-generation-queue'
import { getPrivacyConsent, setPrivacyConsent, type ConsentScopeType } from './privacy-consents'
import {
  createRetrospective,
  getRetrospective,
  listRetrospectives,
  deleteRetrospective,
  type CreateRetrospectiveInput,
  type RetrospectiveFilter
} from './retrospectives'
import { generateWeeklyRetro, generateProjectPhaseRetro } from './retro-generator'
import { recordLocalMetric, countLocalMetrics } from './local-metrics'
import { buildDailyNarrativePlain, generateDailyNarrativeAi } from './daily-narrative'
import {
  buildWeeklyRetroUploadPreview,
  buildRetroUploadPreview,
  buildActivityReportUploadPreview,
  buildDailyNarrativeUploadPreview
} from './upload-preview'
import {
  getActivityProviderStatus,
  getActivityProvider
} from './active-window/index'

let getMainWindow: (() => BrowserWindow | null) | null = null

const MONITORING_SETTINGS = new Set([
  'process_monitoring_enabled',
  'poll_interval_seconds',
  'exclude_processes',
  'process_categories'
])

export function registerIpcHandlers(
  mainWindowGetter: () => BrowserWindow | null
): void {
  getMainWindow = mainWindowGetter

  const notifyActivityUpdated = (): void => {
    getMainWindow?.()?.webContents.send('activity-logs:updated')
  }

  const notifyWorkAssetsUpdated = (dateMs: number): void => {
    const items = listSuggestedForDay(dateMs)
    const { start, end } = (() => {
      const s = new Date(dateMs)
      s.setHours(0, 0, 0, 0)
      const e = new Date(dateMs)
      e.setHours(23, 59, 59, 999)
      return { start: s.getTime(), end: e.getTime() }
    })()
    const confirmed = listWorkAssets({
      status: ['confirmed', 'private'],
      dateStart: start,
      dateEnd: end
    })
    getMainWindow?.()?.webContents.send('work-assets:updated', {
      dateMs,
      suggested: items,
      confirmed,
      count: items.length
    })
  }

  ipcMain.handle('settings:getAll', () => {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    for (const row of rows) settings[row.key] = row.value
    return settings
  })

  ipcMain.handle('settings:get', (_event, key: string) => {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    const db = getDb()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    if (MONITORING_SETTINGS.has(key)) {
      reloadProcessWatcherFromSettings(notifyActivityUpdated)
    }
    return true
  })

  ipcMain.handle(
    'activityLogs:list',
    (
      _event,
      options: { startTime?: number; endTime?: number; limit?: number; offset?: number }
    ) => listActivityLogs(options)
  )

  ipcMain.handle('activityLogs:markImportant', (_event, id: number, important: boolean) => {
    updateActivityField(id, 'is_important', important ? 1 : 0)
    return true
  })

  ipcMain.handle('activity:getProviderStatus', () => getActivityProviderStatus())

  ipcMain.handle('activity:requestPermissions', async () => {
    const provider = getActivityProvider()
    if (!provider.requestPermissions) {
      return { granted: false, message: provider.explainPermissions() }
    }
    return provider.requestPermissions()
  })

  ipcMain.handle('activityLogs:addNote', (_event, id: number, note: string) => {
    updateActivityField(id, 'user_note', note)
    return true
  })

  ipcMain.handle('activityLogs:softDelete', (_event, id: number) => {
    updateActivityField(id, 'is_deleted', 1)
    return true
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle(
    'metrics:record',
    (_event, name: string, payload?: Record<string, unknown>) => {
      try {
        recordLocalMetric(name, payload)
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle('metrics:count', (_event, name?: string | null) =>
    countLocalMetrics(name ?? undefined)
  )

  ipcMain.handle('dailyNarrative:get', (_event, dateMs: number) => buildDailyNarrativePlain(dateMs))

  ipcMain.handle('dailyNarrative:generateAi', (_event, dateMs: number) => generateDailyNarrativeAi(dateMs))

  ipcMain.handle('uploadPreview:dailyNarrative', (_event, dateMs: number) =>
    buildDailyNarrativeUploadPreview(dateMs)
  )

  ipcMain.handle('settings:getDefaultProcessCategories', () => {
    // 将 { process_name: category } 倒转为 { category: [process_names] }
    const byCategory: Record<string, string[]> = {}
    for (const [proc, cat] of Object.entries(DEFAULT_PROCESS_CATEGORIES)) {
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(proc)
    }
    return { mapping: byCategory, labels: CATEGORY_LABELS }
  })

  ipcMain.handle('reports:generateDaily', async (_event, dateMs: number) => {
    const start = new Date(dateMs)
    start.setHours(0, 0, 0, 0)
    const end = new Date(dateMs)
    end.setHours(23, 59, 59, 999)
    const result = await generateDailyReport(dateMs)
    const id = saveReport('daily', start.getTime(), end.getTime(), result.content)
    try {
      recordLocalMetric('report_generated', {
        kind: 'daily',
        reportId: id,
        mode: result.mode,
        dateStart: start.getTime()
      })
    } catch {
      /* ignore metrics errors */
    }
    return { id, ...result }
  })

  ipcMain.handle('reports:generateWeekly', async (_event, weekStartMs: number) => {
    const start = new Date(weekStartMs)
    start.setHours(0, 0, 0, 0)
    const end = new Date(weekStartMs)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    const result = await generateWeeklyReport(weekStartMs)
    const id = saveReport('weekly', start.getTime(), end.getTime(), result.content)
    try {
      recordLocalMetric('report_generated', {
        kind: 'weekly',
        reportId: id,
        mode: result.mode,
        dateStart: start.getTime()
      })
    } catch {
      /* ignore */
    }
    return { id, ...result }
  })

  ipcMain.handle('reports:getLatest', (_event, type: 'daily' | 'weekly') => getLatestReport(type))

  ipcMain.handle(
    'reports:getForPeriod',
    (
      _event,
      payload: { type: 'daily' | 'weekly'; dateStart: number; dateEnd: number }
    ) => getReportForPeriod(payload.type, payload.dateStart, payload.dateEnd)
  )

  ipcMain.handle(
    'reports:listInRange',
    (
      _event,
      payload: {
        dateStart: number
        dateEnd: number
        types?: Array<'daily' | 'weekly'>
        limit?: number
      }
    ) => listReportsInRange(payload)
  )

  ipcMain.handle('projectSpaces:list', () => listProjectSpaces())

  ipcMain.handle('projectSpaces:get', (_event, id: number) => getProjectSpace(id))

  ipcMain.handle('projectSpaces:create', (_event, input: CreateProjectSpaceInput) =>
    createProjectSpace(input)
  )

  ipcMain.handle('projectSpaces:update', (_event, id: number, patch: UpdateProjectSpaceInput) =>
    updateProjectSpace(id, patch)
  )

  ipcMain.handle('projectSpaces:delete', (_event, id: number) => deleteProjectSpace(id))

  ipcMain.handle(
    'projectSpaces:replaceAliases',
    (
      _event,
      projectId: number,
      aliases: Array<{ aliasType: ProjectAliasType; value: string; alias?: string }>
    ) => replaceProjectAliases(projectId, aliases)
  )

  ipcMain.handle('projectSpaces:listAliases', (_event, projectId: number) =>
    listProjectAliases(projectId)
  )

  ipcMain.handle(
    'projectSpaces:addAlias',
    (_event, projectId: number, aliasType: ProjectAliasType, value: string, alias?: string) =>
      addProjectAlias(projectId, aliasType, value, alias)
  )

  ipcMain.handle('workAssets:list', (_event, filter: WorkAssetFilter) => listWorkAssets(filter))

  ipcMain.handle('workAssets:countByProject', (_event, projectId: number) =>
    countWorkAssetsByProject(projectId)
  )

  ipcMain.handle('workAssets:get', (_event, id: number) => getWorkAsset(id))

  ipcMain.handle('workAssets:update', (_event, id: number, patch: UpdateWorkAssetPatch) => {
    const result = updateWorkAsset(id, patch)
    if (result?.startedAt) notifyWorkAssetsUpdated(result.startedAt)
    return result
  })

  ipcMain.handle('workAssets:generateSuggested', (_event, dateMs: number, force?: boolean) => {
    return scheduleGenerateSuggestedAssets(dateMs, force ?? false, notifyWorkAssetsUpdated)
  })

  ipcMain.handle('workAssets:confirm', (_event, id: number, patch?: UpdateWorkAssetPatch) => {
    const result = updateWorkAsset(id, { ...patch, status: 'confirmed' })
    if (result) {
      try {
        recordLocalMetric('asset_confirmed', {
          id: result.id,
          projectId: result.projectId
        })
      } catch {
        /* ignore */
      }
    }
    if (result?.startedAt) notifyWorkAssetsUpdated(result.startedAt)
    return result
  })

  ipcMain.handle('workAssets:ignore', (_event, id: number) => {
    const before = getWorkAsset(id)
    const result = updateWorkAsset(id, { status: 'ignored' })
    if (result) {
      try {
        recordLocalMetric('asset_dismissed', { id: result.id })
      } catch {
        /* ignore */
      }
    }
    if (before?.startedAt) notifyWorkAssetsUpdated(before.startedAt)
    return result
  })

  ipcMain.handle('workAssets:markPrivate', (_event, id: number) => {
    const before = getWorkAsset(id)
    const result = updateWorkAsset(id, { status: 'private' })
    if (result) {
      try {
        recordLocalMetric('asset_private', { id: result.id })
      } catch {
        /* ignore */
      }
    }
    if (before?.startedAt) notifyWorkAssetsUpdated(before.startedAt)
    return result
  })

  ipcMain.handle('workAssets:merge', (_event, ids: number[]) => {
    const result = mergeWorkAssets(ids)
    if (result?.startedAt) notifyWorkAssetsUpdated(result.startedAt)
    return result
  })

  ipcMain.handle('workAssets:split', (_event, id: number, parts: SplitWorkAssetPart[]) => {
    const results = splitWorkAsset(id, parts)
    const first = results[0]
    if (first?.startedAt) notifyWorkAssetsUpdated(first.startedAt)
    return results
  })

  ipcMain.handle(
    'uploadPreview:retroWeekly',
    (_event, projectId: number | null, weekStartMs: number) =>
      buildWeeklyRetroUploadPreview(projectId, weekStartMs)
  )

  ipcMain.handle(
    'uploadPreview:retroPhase',
    (_event, projectId: number, dateStart: number, dateEnd: number) =>
      buildRetroUploadPreview('project_phase', projectId, dateStart, dateEnd)
  )

  ipcMain.handle(
    'uploadPreview:activityReport',
    async (_event, dateStart: number, dateEnd: number) => buildActivityReportUploadPreview(dateStart, dateEnd)
  )

  ipcMain.handle(
    'privacyConsents:get',
    (_event, scopeType: ConsentScopeType, scopeId: string | null, capability: string) =>
      getPrivacyConsent(scopeType, scopeId, capability)
  )

  ipcMain.handle(
    'privacyConsents:set',
    (
      _event,
      scopeType: ConsentScopeType,
      scopeId: string | null,
      capability: string,
      enabled: boolean
    ) => setPrivacyConsent(scopeType, scopeId, capability, enabled)
  )

  ipcMain.handle('reports:exportMarkdown', async (_event, content: string, defaultName: string) =>
    exportContentToFile(content, defaultName)
  )

  ipcMain.handle('content:export', async (_event, content: string, defaultName: string) =>
    exportContentToFile(content, defaultName)
  )

  ipcMain.handle(
    'dialog:pickDirectory',
    async (
      _event,
      options?: { defaultPath?: string; title?: string; multiple?: boolean }
    ): Promise<string | string[] | null> => {
      const win = getMainWindow?.()
      const dialogOpts = {
        title: options?.title ?? (options?.multiple ? '选择目录' : '选择文件夹'),
        defaultPath: options?.defaultPath,
        properties: (options?.multiple
          ? ['openDirectory', 'multiSelections']
          : ['openDirectory']) as Array<'openDirectory' | 'multiSelections'>
      }
      const { canceled, filePaths } = win
        ? await dialog.showOpenDialog(win, dialogOpts)
        : await dialog.showOpenDialog(dialogOpts)
      if (canceled || filePaths.length === 0) return null
      return options?.multiple ? filePaths : filePaths[0]!
    }
  )

  ipcMain.handle('retrospectives:list', (_event, filter?: RetrospectiveFilter) =>
    listRetrospectives(filter ?? {})
  )

  ipcMain.handle('retrospectives:get', (_event, id: number) => getRetrospective(id))

  ipcMain.handle('retrospectives:save', (_event, input: CreateRetrospectiveInput) =>
    createRetrospective(input)
  )

  ipcMain.handle('retrospectives:delete', (_event, id: number) => deleteRetrospective(id))

  ipcMain.handle(
    'retrospectives:generateWeekly',
    async (
      _event,
      projectId: number | null,
      weekStartMs: number,
      extra?: { includeReportIds?: number[] }
    ) => {
      const out = await generateWeeklyRetro(projectId, weekStartMs, extra)
      try {
        recordLocalMetric('retro_generated', {
          kind: 'weekly',
          projectId,
          weekStartMs,
          includedReportCount: out.sourceReportIds.length
        })
      } catch {
        /* ignore */
      }
      return out
    }
  )

  ipcMain.handle(
    'retrospectives:generatePhase',
    async (
      _event,
      projectId: number,
      dateStart: number,
      dateEnd: number,
      extra?: { includeReportIds?: number[] }
    ) => {
      const out = await generateProjectPhaseRetro(projectId, dateStart, dateEnd, extra)
      try {
        recordLocalMetric('retro_generated', {
          kind: 'project_phase',
          projectId,
          dateStart,
          dateEnd,
          includedReportCount: out.sourceReportIds.length
        })
      } catch {
        /* ignore */
      }
      return out
    }
  )
}

async function exportContentToFile(content: string, defaultName: string): Promise<boolean> {
  const win = getMainWindow?.()
  if (!win) return false

  const ext = defaultName.split('.').pop()?.toLowerCase() ?? 'md'
  const filters =
    ext === 'json'
      ? [{ name: 'JSON', extensions: ['json'] }]
      : [{ name: 'Markdown', extensions: ['md'] }]

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出',
    defaultPath: defaultName,
    filters
  })

  if (canceled || !filePath) return false

  writeFileSync(filePath, content, 'utf-8')
  return true
}

function listWorkAssetsForDay(
  dateMs: number,
  status: WorkAssetFilter['status']
): ReturnType<typeof listWorkAssets> {
  const start = new Date(dateMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateMs)
  end.setHours(23, 59, 59, 999)
  return listWorkAssets({
    status,
    dateStart: start.getTime(),
    dateEnd: end.getTime()
  })
}

export function initProcessWatcherOnReady(): void {
  reloadProcessWatcherFromSettings(() => {
    getMainWindow?.()?.webContents.send('activity-logs:updated')
  })
}
