import type {
  DailySealRecord,
  ProjectSpace,
  TodayMainlineSuggestion,
  UpsertDailySealInput
} from '@/env'

export type { TodayMainlineSuggestion }

export interface TodaySealResult {
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
  reportContent?: string
  reportMode?: 'ai' | 'offline'
  reportSource?: 'seal' | 'legacy' | 'battle'
  reportVersion?: 'v3' | 'v2' | 'battle-v3'
}

export async function suggestTodayMainline(dateMs: number): Promise<TodayMainlineSuggestion> {
  return window.electronAPI.suggestTodayMainline(dateMs)
}

export async function getDailySeal(dateMs: number): Promise<DailySealRecord | null> {
  return window.electronAPI.getDailySeal(dateMs)
}

export async function saveDailySeal(input: UpsertDailySealInput): Promise<DailySealRecord> {
  return window.electronAPI.upsertDailySeal(input)
}

export function todaySealResultToUpsert(
  result: TodaySealResult
): UpsertDailySealInput {
  return {
    dateMs: result.dateMs,
    projectId: result.projectId,
    projectName: result.projectName,
    parsedProjectLabel: result.parsedProjectLabel,
    taskHint: result.taskHint,
    note: result.note,
    skippedMainline: result.skippedMainline,
    evidenceSuggested: result.evidenceSuggested,
    evidenceArchived: result.evidenceArchived,
    evidenceDismissed: result.evidenceDismissed,
    completedAt: result.completedAt
  }
}

const SEAL_MODE_KEY = 'today_inbox_mode'

export type TodayInboxMode = 'seal' | 'classic'

export function getTodayInboxMode(): TodayInboxMode {
  try {
    const v = localStorage.getItem(SEAL_MODE_KEY)
    return v === 'classic' ? 'classic' : 'seal'
  } catch {
    return 'seal'
  }
}

export function setTodayInboxMode(mode: TodayInboxMode): void {
  try {
    localStorage.setItem(SEAL_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function projectDisplayName(space: ProjectSpace): string {
  const alias = space.privacyAlias?.trim()
  return alias || space.name
}
