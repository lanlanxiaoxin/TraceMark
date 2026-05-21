import type { AssetStatus, EvidenceItem, WorkAsset } from '@/env'

export interface AssetSnapshot {
  id: number
  status: AssetStatus
  title: string
  description: string | null
  impact: string | null
  confidence: WorkAsset['confidence']
  evidence: EvidenceItem[]
  startedAt: number | null
  endedAt: number | null
}

export function snapshotFromAsset(asset: WorkAsset): AssetSnapshot {
  return {
    id: asset.id,
    status: asset.status,
    title: asset.title,
    description: asset.description,
    impact: asset.impact,
    confidence: asset.confidence,
    evidence: asset.evidence,
    startedAt: asset.startedAt,
    endedAt: asset.endedAt
  }
}

export function snapshotWithEdits(
  asset: WorkAsset,
  edits?: { title?: string; description?: string | null }
): AssetSnapshot {
  const base = snapshotFromAsset(asset)
  return {
    ...base,
    title: edits?.title ?? base.title,
    description: edits?.description !== undefined ? edits.description : base.description
  }
}
