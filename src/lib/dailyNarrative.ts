import type { DailyNarrativeAiResult } from '@/env'

export async function getDailyNarrative(dateMs: number): Promise<string> {
  return window.electronAPI.getDailyNarrative(dateMs)
}

export async function generateDailyNarrativeAi(dateMs: number): Promise<DailyNarrativeAiResult> {
  return window.electronAPI.generateDailyNarrativeAi(dateMs)
}
