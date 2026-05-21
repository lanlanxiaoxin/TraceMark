import { getDb } from './database'
import { getActiveWindow } from './active-window/index'
import { maybeCaptureEnhancedSummary } from './enrichment/enhanced-summary'
import { upsertActivitySnapshot } from './activity-logs'
import {
  parseWindowTitle,
  DEFAULT_PROCESS_CATEGORIES,
  type ActivityCategory
} from './window-title-parser'
import { getExcludeTitleKeywords, sanitizeActivityFields } from './sanitizer'
import { matchProjectId } from './project-spaces'
import { captureGitDiffSnapshot } from './enrichment/git-enrichment'

let pollTimer: ReturnType<typeof setInterval> | null = null
let openSegmentId: number | null = null
let onActivityUpdated: (() => void) | null = null

// 编码会话边界检测（用于 git diff 快照触发）
let prevCategory: ActivityCategory | null = null
let prevProject: string | null = null
let codingDebounceTimer: ReturnType<typeof setTimeout> | null = null
const CODING_DEBOUNCE_MS = 120_000

const DEFAULT_EXCLUDES = new Set([
  'electron',
  'workflow-ai',
  'applicationframehost',
  'searchhost',
  'shellexperiencehost',
  'systemsettings',
  'textinputhost'
])

function readSetting(key: string, fallback: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

function isMonitoringEnabled(): boolean {
  return readSetting('process_monitoring_enabled', 'true') === 'true'
}

function getPollIntervalMs(): number {
  const seconds = Number.parseInt(readSetting('poll_interval_seconds', '5'), 10)
  if (!Number.isFinite(seconds) || seconds < 3) return 5000
  return seconds * 1000
}

function getExcludedProcesses(): Set<string> {
  try {
    const raw = JSON.parse(readSetting('exclude_processes', '[]')) as string[]
    return new Set([...DEFAULT_EXCLUDES, ...raw.map(p => p.toLowerCase())])
  } catch {
    return DEFAULT_EXCLUDES
  }
}

function matchesTitleKeyword(title: string): boolean {
  const keywords = getExcludeTitleKeywords()
  const lower = title.toLowerCase()
  return keywords.some(k => lower.includes(k.toLowerCase()))
}

function getProcessCategoryMappings(): Record<string, ActivityCategory> {
  try {
    const raw = JSON.parse(readSetting('process_categories', '{}')) as Record<string, string[]>
    if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_PROCESS_CATEGORIES }

    // 将 { category: [process_names] } 展平为 { process_name: category }
    const overrides: Record<string, ActivityCategory> = {}
    for (const [category, processes] of Object.entries(raw)) {
      if (!Array.isArray(processes)) continue
      for (const proc of processes) {
        overrides[proc.toLowerCase().replace(/\.exe$/i, '')] = category as ActivityCategory
      }
    }
    // 与默认值合并，自定义优先
    return { ...DEFAULT_PROCESS_CATEGORIES, ...overrides }
  } catch {
    return { ...DEFAULT_PROCESS_CATEGORIES }
  }
}

function shouldSkip(processName: string, windowTitle: string): boolean {
  const excludes = getExcludedProcesses()
  if (excludes.has(processName.toLowerCase())) return true
  if (!windowTitle.trim()) return true
  if (matchesTitleKeyword(windowTitle)) return true
  return false
}

async function pollOnce(): Promise<void> {
  if (!isMonitoringEnabled()) return

  const active = await getActiveWindow()
  if (!active) return
  if (shouldSkip(active.processName, active.windowTitle)) return

  const categoryOverrides = getProcessCategoryMappings()
  const parsed = parseWindowTitle(active.processName, active.windowTitle, categoryOverrides)
  const sanitized = sanitizeActivityFields(
    active.windowTitle,
    parsed.parsedProject,
    parsed.parsedFile
  )

  const now = Date.now()
  const prevSegmentId = openSegmentId
  openSegmentId = upsertActivitySnapshot(
    active.processName,
    active.windowTitle,
    active.executablePath,
    {
      category: parsed.category,
      parsedProject: sanitized.parsedProject,
      parsedFile: sanitized.parsedFile,
      sanitizedTitle: sanitized.sanitizedTitle
    },
    now,
    openSegmentId
  )
  // 仅在活动段切换（新窗口/新进程）时通知 UI 刷新
  // ended_at 持续更新仍写入 DB，避免每 5s 触发全量重绘导致频闪
  if (openSegmentId !== prevSegmentId) {
    onActivityUpdated?.()
    const projectId = matchProjectId(
      sanitized.parsedProject,
      active.windowTitle,
      sanitized.sanitizedTitle,
      {
        category: parsed.category,
        parsedFile: sanitized.parsedFile,
        processName: active.processName,
        executablePath: active.executablePath
      }
    )
    if (openSegmentId != null) {
      void maybeCaptureEnhancedSummary({
      activityLogId: openSegmentId,
      projectId,
      processName: active.processName,
      category: parsed.category,
      parsedFile: sanitized.parsedFile,
      sanitizedTitle: sanitized.sanitizedTitle,
      parsedProject: sanitized.parsedProject
      })
    }
  }

  // === 编码会话边界检测（用于 git diff 快照触发） ===
  const currentCategory = parsed.category
  const currentProject = sanitized.parsedProject

  if (currentCategory === 'code_editor') {
    // 切回编码 → 如果在 debounce 窗口内且同一项目，取消定时器
    if (prevCategory !== 'code_editor' && prevCategory !== null) {
      if (currentProject === prevProject && codingDebounceTimer) {
        clearTimeout(codingDebounceTimer)
        codingDebounceTimer = null
      }
    }
  } else {
    // 切走编码 → 启动 2 分钟 debounce
    if (prevCategory === 'code_editor' && prevProject && !codingDebounceTimer) {
      const project = prevProject
      codingDebounceTimer = setTimeout(() => {
        codingDebounceTimer = null
        captureGitDiffSnapshot(project).catch(() => { /* silent */ })
      }, CODING_DEBOUNCE_MS)
    }
  }

  prevCategory = currentCategory
  prevProject = currentProject
}

export function startProcessWatcher(onUpdated?: () => void): void {
  stopProcessWatcher()
  onActivityUpdated = onUpdated ?? null
  if (!isMonitoringEnabled()) return

  void pollOnce()
  pollTimer = setInterval(() => {
    void pollOnce()
  }, getPollIntervalMs())
}

export function stopProcessWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (codingDebounceTimer) {
    clearTimeout(codingDebounceTimer)
    codingDebounceTimer = null
  }
  openSegmentId = null
  prevCategory = null
  prevProject = null
}

export function reloadProcessWatcherFromSettings(onUpdated?: () => void): void {
  startProcessWatcher(onUpdated)
}
