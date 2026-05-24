import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkAsset } from '@/env'
import { recordMetric } from '@/lib/metrics'
import { EvidenceList } from './EvidenceList'

interface WorkAssetCardProps {
  asset: WorkAsset
  selected?: boolean
  onSelect?: (id: number, selected: boolean) => void
  onConfirm: (id: number, note?: string, title?: string) => void
  onIgnore: (id: number) => void
  onPrivate: (id: number) => void
  onSplit?: (id: number, draftTitle?: string) => void
  onJumpTimeline?: (asset: WorkAsset) => void
  busy?: boolean
}

export function WorkAssetCard({
  asset,
  selected,
  onSelect,
  onConfirm,
  onIgnore,
  onPrivate,
  onSplit,
  onJumpTimeline,
  busy
}: WorkAssetCardProps): JSX.Element {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [editTitle, setEditTitle] = useState(asset.title)
  const isEvidenceOnly = asset.assetKind === 'evidence'

  const kindKey =
    asset.assetKind === 'outcome'
      ? 'workAsset.kindOutcome'
      : asset.assetKind === 'process'
        ? 'workAsset.kindProcess'
        : 'workAsset.kindEvidence'
  const kindLabel = t(kindKey)
  const confidenceLevel =
    asset.confidence === 'high'
      ? t('workAsset.confidenceHigh')
      : asset.confidence === 'medium'
        ? t('workAsset.confidenceMedium')
        : t('workAsset.confidenceLow')

  return (
    <article
      className={`rounded-xl border bg-white p-4 space-y-3 ${
        asset.confidence === 'low' ? 'border-amber-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3" role="group">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={e => onSelect(asset.id, e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-gray-300"
            aria-label={t('workAsset.selectToMerge')}
          />
        )}
        <div className="flex flex-wrap gap-2 flex-1">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            {kindLabel}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {t('workAsset.confidenceLabel', { level: confidenceLevel })}
          </span>
        </div>
      </div>

      {asset.status === 'suggested' ? (
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          className="w-full text-sm font-medium text-gray-900 rounded-lg border border-gray-200 px-3 py-2"
          aria-label={t('workAsset.titleAria')}
        />
      ) : (
        <h3 className="text-sm font-medium text-gray-900">{asset.title}</h3>
      )}

      {asset.description && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{asset.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const next = !expanded
            setExpanded(next)
            if (next) void recordMetric('asset_evidence_expanded', { assetId: asset.id })
          }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {expanded
            ? t('workAsset.collapseEvidence')
            : t('workAsset.expandEvidence', { count: asset.evidence.length })}
        </button>
        {onJumpTimeline &&
          (asset.startedAt != null ||
            asset.evidence.some(e => e.activityLogId != null || e.startedAt != null)) && (
            <button
              type="button"
              onClick={() => {
                void recordMetric('asset_timeline_jumped', {
                  assetId: asset.id,
                  startedAt: asset.startedAt ?? asset.createdAt
                })
                onJumpTimeline(asset)
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              {t('workAsset.jumpTimeline')}
            </button>
          )}
      </div>
      {expanded && <EvidenceList evidence={asset.evidence} />}

      {asset.status === 'suggested' && asset.confidence === 'low' && (
        <div>
          <label htmlFor={`note-${asset.id}`} className="block text-xs font-medium text-gray-600 mb-1">
            {t('workAsset.noteLabel')}
          </label>
          <input
            id={`note-${asset.id}`}
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('workAsset.notePlaceholder')}
            className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2"
          />
        </div>
      )}

      {asset.status === 'suggested' && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={busy || isEvidenceOnly}
            onClick={() => onConfirm(asset.id, note || undefined, editTitle)}
            title={isEvidenceOnly ? t('workAsset.evidenceOnlyHint') : undefined}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-40"
          >
            {t('workAsset.confirm')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onIgnore(asset.id)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            {t('workAsset.ignore')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPrivate(asset.id)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            {t('workAsset.private')}
          </button>
          {onSplit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSplit(asset.id, editTitle)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              {t('workAsset.split')}
            </button>
          )}
        </div>
      )}
    </article>
  )
}
