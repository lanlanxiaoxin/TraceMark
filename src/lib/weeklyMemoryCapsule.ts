import type { WeeklyMemoryCapsulePayload } from '@/env'

export function getWeeklyMemoryCapsule(weekStartMs: number): Promise<WeeklyMemoryCapsulePayload> {
  return window.electronAPI.getWeeklyMemoryCapsule(weekStartMs)
}
