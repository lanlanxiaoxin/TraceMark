import type {
  CreateRetrospectiveInput,
  GenerateRetroResult,
  Retrospective,
  RetrospectiveFilter
} from '@/env'

export function listRetrospectives(filter?: RetrospectiveFilter): Promise<Retrospective[]> {
  return window.electronAPI.listRetrospectives(filter)
}

export function getRetrospective(id: number): Promise<Retrospective | null> {
  return window.electronAPI.getRetrospective(id)
}

export function saveRetrospective(input: CreateRetrospectiveInput): Promise<Retrospective> {
  return window.electronAPI.saveRetrospective(input)
}

export function deleteRetrospective(id: number): Promise<boolean> {
  return window.electronAPI.deleteRetrospective(id)
}

export function generateWeeklyRetro(
  projectId: number | null,
  weekStartMs: number,
  extra?: { includeReportIds?: number[] }
): Promise<GenerateRetroResult> {
  return window.electronAPI.generateWeeklyRetro(projectId, weekStartMs, extra)
}

export function generateProjectPhaseRetro(
  projectId: number,
  dateStart: number,
  dateEnd: number,
  extra?: { includeReportIds?: number[] }
): Promise<GenerateRetroResult> {
  return window.electronAPI.generateProjectPhaseRetro(projectId, dateStart, dateEnd, extra)
}

export function currentWeekStartMs(): number {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function weekBounds(weekStartMs: number): { start: number; end: number } {
  const start = new Date(weekStartMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(weekStartMs)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}
