import type { GenerateReportResult, StoredReport, StoredReportSummary } from '@/env'

export async function generateDailyReport(dateMs: number): Promise<GenerateReportResult> {
  return window.electronAPI.generateDailyReport(dateMs)
}

export async function generateWeeklyReport(weekStartMs: number): Promise<GenerateReportResult> {
  return window.electronAPI.generateWeeklyReport(weekStartMs)
}

export async function getLatestReport(type: 'daily' | 'weekly'): Promise<StoredReport | null> {
  return window.electronAPI.getLatestReport(type)
}

export async function getReportForPeriod(payload: {
  type: 'daily' | 'weekly'
  dateStart: number
  dateEnd: number
}): Promise<StoredReport | null> {
  return window.electronAPI.getReportForPeriod(payload)
}

export async function listReportsInRange(payload: {
  dateStart: number
  dateEnd: number
  types?: Array<'daily' | 'weekly'>
  limit?: number
}): Promise<StoredReportSummary[]> {
  return window.electronAPI.listReportsInRange(payload)
}

export async function exportMarkdown(content: string, defaultName: string): Promise<boolean> {
  return window.electronAPI.exportMarkdown(content, defaultName)
}

export function startOfWeek(ts: number): number {
  const d = new Date(ts)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
