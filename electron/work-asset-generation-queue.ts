import {
  generateSuggestedAssets,
  hasAnyAssetsForDay,
  listSuggestedForDay
} from './work-asset-generator'
import type { WorkAsset } from './work-assets'
import { recordLocalMetric } from './local-metrics'

export type GenerateJobStatus = 'ready' | 'generating'

export interface GenerateJobResult {
  status: GenerateJobStatus
  count?: number
  items?: WorkAsset[]
}

const inFlightByDay = new Set<number>()

function dayStartKey(dateMs: number): number {
  const start = new Date(dateMs)
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

export function scheduleGenerateSuggestedAssets(
  dateMs: number,
  force: boolean,
  onComplete: (dateMs: number) => void
): GenerateJobResult {
  const dayKey = dayStartKey(dateMs)
  const existing = listSuggestedForDay(dateMs)

  if (!force && existing.length > 0) {
    return { status: 'ready', count: existing.length, items: existing }
  }

  if (!force && hasAnyAssetsForDay(dateMs)) {
    return { status: 'ready', count: 0, items: [] }
  }

  if (inFlightByDay.has(dayKey)) {
    return { status: 'generating' }
  }

  inFlightByDay.add(dayKey)
  setImmediate(() => {
    try {
      generateSuggestedAssets(dateMs, force)
      const suggestedCount = listSuggestedForDay(dateMs).length
      try {
        recordLocalMetric('asset_generated', {
          dayStart: dayKey,
          suggestedCount,
          force
        })
      } catch (e) {
        console.error('[local-metrics]', e)
      }
      onComplete(dateMs)
    } catch (err) {
      console.error('[work-asset-generation]', err)
      onComplete(dateMs)
    } finally {
      inFlightByDay.delete(dayKey)
    }
  })

  return { status: 'generating' }
}

export function isGeneratingForDay(dateMs: number): boolean {
  return inFlightByDay.has(dayStartKey(dateMs))
}
