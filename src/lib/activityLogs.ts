import type { ActivityLog, ListActivityLogsOptions, ListActivityLogsResult } from '@/env'
import i18n from '@/i18n'
import { getDateLocaleTag } from '@/i18n'

export type { ActivityLog, ListActivityLogsOptions, ListActivityLogsResult }

export async function listActivityLogs(
  options: ListActivityLogsOptions = {}
): Promise<ListActivityLogsResult> {
  return window.electronAPI.listActivityLogs(options)
}

export function subscribeActivityLogsUpdated(callback: () => void): () => void {
  return window.electronAPI.onActivityLogsUpdated(callback)
}

export async function markActivityImportant(id: number, important: boolean): Promise<void> {
  await window.electronAPI.markActivityImportant(id, important)
}

export async function addActivityNote(id: number, note: string): Promise<void> {
  await window.electronAPI.addActivityNote(id, note)
}

export async function softDeleteActivity(id: number): Promise<void> {
  await window.electronAPI.softDeleteActivity(id)
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function formatDayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return i18n.t('common.today')
  if (sameDay(d, yesterday)) return i18n.t('common.yesterday')

  return d.toLocaleDateString(getDateLocaleTag(), {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(getDateLocaleTag(), {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDuration(startedAt: number, endedAt: number): string {
  const seconds = Math.max(0, Math.round((endedAt - startedAt) / 1000))
  if (seconds < 60) return i18n.t('timeline.durationSeconds', { seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return i18n.t('timeline.durationMinutes', { minutes })
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return remainMinutes > 0
    ? i18n.t('timeline.durationHoursMinutes', { hours, minutes: remainMinutes })
    : i18n.t('timeline.durationHours', { hours })
}
