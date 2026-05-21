import type { UploadPreview } from '@/env'

export function buildRetroWeeklyPreview(
  projectId: number | null,
  weekStartMs: number
): Promise<UploadPreview> {
  return window.electronAPI.buildRetroWeeklyPreview(projectId, weekStartMs)
}

export function buildRetroPhasePreview(
  projectId: number,
  dateStart: number,
  dateEnd: number
): Promise<UploadPreview> {
  return window.electronAPI.buildRetroPhasePreview(projectId, dateStart, dateEnd)
}

export function buildActivityReportPreview(
  dateStart: number,
  dateEnd: number
): Promise<UploadPreview> {
  return window.electronAPI.buildActivityReportPreview(dateStart, dateEnd)
}

export function buildDailyNarrativeUploadPreview(dateMs: number): Promise<UploadPreview> {
  return window.electronAPI.buildDailyNarrativeUploadPreview(dateMs)
}
