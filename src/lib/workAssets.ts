import type {
  GenerateSuggestedResult,
  SplitWorkAssetPart,
  UpdateWorkAssetPatch,
  WorkAsset,
  WorkAssetFilter,
  WorkAssetsUpdatedPayload
} from '@/env'

export function listWorkAssets(filter: WorkAssetFilter): Promise<WorkAsset[]> {
  return window.electronAPI.listWorkAssets(filter)
}

export function getWorkAsset(id: number): Promise<WorkAsset | null> {
  return window.electronAPI.getWorkAsset(id)
}

export function updateWorkAsset(id: number, patch: UpdateWorkAssetPatch): Promise<WorkAsset | null> {
  return window.electronAPI.updateWorkAsset(id, patch)
}

export function generateSuggestedAssets(
  dateMs: number,
  force?: boolean
): Promise<GenerateSuggestedResult> {
  return window.electronAPI.generateSuggestedAssets(dateMs, force)
}

export function onWorkAssetsUpdated(
  callback: (payload: WorkAssetsUpdatedPayload) => void
): () => void {
  return window.electronAPI.onWorkAssetsUpdated(callback)
}

export function confirmWorkAsset(
  id: number,
  patch?: UpdateWorkAssetPatch
): Promise<WorkAsset | null> {
  return window.electronAPI.confirmWorkAsset(id, patch)
}

export function ignoreWorkAsset(id: number): Promise<WorkAsset | null> {
  return window.electronAPI.ignoreWorkAsset(id)
}

export function markPrivateWorkAsset(id: number): Promise<WorkAsset | null> {
  return window.electronAPI.markPrivateWorkAsset(id)
}

export function mergeWorkAssets(ids: number[]): Promise<WorkAsset | null> {
  return window.electronAPI.mergeWorkAssets(ids)
}

export function splitWorkAsset(id: number, parts: SplitWorkAssetPart[]): Promise<WorkAsset[]> {
  return window.electronAPI.splitWorkAsset(id, parts)
}

export function countWorkAssetsByProject(projectId: number): Promise<number> {
  return window.electronAPI.countWorkAssetsByProject(projectId)
}

export function dayBounds(dateMs: number): { start: number; end: number } {
  const start = new Date(dateMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateMs)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

export function exportContent(content: string, defaultName: string): Promise<boolean> {
  return window.electronAPI.exportContent(content, defaultName)
}
