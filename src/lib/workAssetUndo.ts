import type { WorkAsset } from '@/env'
import { updateWorkAsset } from '@/lib/workAssets'

/** 撤销前完整快照，用于恢复 suggested 列表中的卡片 */
export interface WorkAssetUndoSnapshot {
  id: number
  projectId: number | null
  title: string
  assetKind: WorkAsset['assetKind']
  assetType: string
  description: string | null
  impact: string | null
  confidence: WorkAsset['confidence']
  status: WorkAsset['status']
  evidence: WorkAsset['evidence']
  tags: string[]
  startedAt: number | null
  endedAt: number | null
}

export function snapshotWorkAsset(asset: WorkAsset): WorkAssetUndoSnapshot {
  return {
    id: asset.id,
    projectId: asset.projectId,
    title: asset.title,
    assetKind: asset.assetKind,
    assetType: asset.assetType,
    description: asset.description,
    impact: asset.impact,
    confidence: asset.confidence,
    status: asset.status,
    evidence: asset.evidence,
    tags: asset.tags,
    startedAt: asset.startedAt,
    endedAt: asset.endedAt
  }
}

export async function restoreWorkAsset(snapshot: WorkAssetUndoSnapshot): Promise<WorkAsset | null> {
  return updateWorkAsset(snapshot.id, {
    projectId: snapshot.projectId,
    title: snapshot.title,
    assetKind: snapshot.assetKind,
    assetType: snapshot.assetType,
    description: snapshot.description,
    impact: snapshot.impact,
    confidence: snapshot.confidence,
    status: snapshot.status,
    evidence: snapshot.evidence,
    tags: snapshot.tags,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt
  })
}
