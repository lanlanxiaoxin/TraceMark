import { useState } from 'react'
import type { WorkAsset } from '@/env'
import { EvidenceList } from './EvidenceList'

const KIND_LABELS: Record<string, string> = {
  outcome: '成果',
  process: '过程',
  evidence: '证据'
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '待确认'
}

interface WorkAssetCardProps {
  asset: WorkAsset
  selected?: boolean
  onSelect?: (id: number, selected: boolean) => void
  onConfirm: (id: number, note?: string, title?: string) => void
  onIgnore: (id: number) => void
  onPrivate: (id: number) => void
  onSplit?: (id: number) => void
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
  busy
}: WorkAssetCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [editTitle, setEditTitle] = useState(asset.title)
  const isEvidenceOnly = asset.assetKind === 'evidence'

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
            aria-label="选择以合并"
          />
        )}
        <div className="flex flex-wrap gap-2 flex-1">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            {KIND_LABELS[asset.assetKind] ?? asset.assetKind}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            置信度：{CONFIDENCE_LABELS[asset.confidence] ?? asset.confidence}
          </span>
        </div>
      </div>

      {asset.status === 'suggested' ? (
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          className="w-full text-sm font-medium text-gray-900 rounded-lg border border-gray-200 px-3 py-2"
          aria-label="卡片标题"
        />
      ) : (
        <h3 className="text-sm font-medium text-gray-900">{asset.title}</h3>
      )}

      {asset.description && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{asset.description}</p>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        {expanded ? '收起证据' : `查看证据（${asset.evidence.length}）`}
      </button>
      {expanded && <EvidenceList evidence={asset.evidence} />}

      {asset.status === 'suggested' && asset.confidence === 'low' && (
        <div>
          <label htmlFor={`note-${asset.id}`} className="block text-xs font-medium text-gray-600 mb-1">
            补一句话（提升可信度）
          </label>
          <input
            id={`note-${asset.id}`}
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例如：完成了登录态刷新接口联调"
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
            title={isEvidenceOnly ? '证据卡需合并到成果/过程卡' : undefined}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-40"
          >
            确认
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onIgnore(asset.id)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            忽略
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPrivate(asset.id)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            私密
          </button>
          {onSplit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSplit(asset.id)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              拆分
            </button>
          )}
        </div>
      )}
    </article>
  )
}
