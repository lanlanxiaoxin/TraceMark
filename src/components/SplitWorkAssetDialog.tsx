import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import type { EvidenceItem, WorkAsset } from '@/env'

export interface SplitConfirmPayload {
  titleA: string
  titleB: string
  evidenceA: EvidenceItem[]
  evidenceB: EvidenceItem[]
}

interface SplitWorkAssetDialogProps {
  asset: WorkAsset | null
  onConfirm: (payload: SplitConfirmPayload) => void
  onCancel: () => void
  busy?: boolean
}

/** 0 = 第一条，1 = 第二条 */
function defaultAssignments(count: number): number[] {
  if (count <= 1) return Array(count).fill(0)
  const mid = Math.ceil(count / 2)
  return Array.from({ length: count }, (_, i) => (i >= mid ? 1 : 0))
}

export function SplitWorkAssetDialog({
  asset,
  onConfirm,
  onCancel,
  busy
}: SplitWorkAssetDialogProps): JSX.Element | null {
  const { t } = useTranslation()
  const [titleA, setTitleA] = useState('')
  const [titleB, setTitleB] = useState('')
  const [assignTo, setAssignTo] = useState<number[]>([])
  const initializedForId = useRef<number | null>(null)

  useEffect(() => {
    if (!asset) {
      initializedForId.current = null
      return
    }
    if (initializedForId.current === asset.id) return
    initializedForId.current = asset.id
    setTitleA(asset.title)
    setTitleB(`${asset.title}${i18n.t('splitDialog.titleBSuffix')}`)
    setAssignTo(defaultAssignments(asset.evidence.length))
  }, [asset])

  const splitValid = useMemo(() => {
    if (!asset || asset.evidence.length < 2) return true
    const hasA = assignTo.some(v => v === 0)
    const hasB = assignTo.some(v => v === 1)
    return hasA && hasB
  }, [asset, assignTo])

  if (!asset) return null

  const canSubmit =
    titleA.trim().length > 0 && titleB.trim().length > 0 && !busy && splitValid

  const handleConfirm = (): void => {
    const evidenceA: EvidenceItem[] = []
    const evidenceB: EvidenceItem[] = []
    asset.evidence.forEach((item, i) => {
      if (assignTo[i] === 1) evidenceB.push(item)
      else evidenceA.push(item)
    })
    onConfirm({
      titleA: titleA.trim(),
      titleB: titleB.trim(),
      evidenceA,
      evidenceB
    })
  }

  const setItemTarget = (index: number, target: 0 | 1): void => {
    setAssignTo(prev => {
      const next = [...prev]
      next[index] = target
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="split-asset-title"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl border border-gray-200"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 id="split-asset-title" className="text-lg font-semibold text-gray-900">
            {t('splitDialog.title')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t('splitDialog.subtitle')}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label htmlFor="split-title-a" className="block text-sm font-medium text-gray-700 mb-1">
              {t('splitDialog.titleA')}
            </label>
            <input
              id="split-title-a"
              type="text"
              value={titleA}
              onChange={e => setTitleA(e.target.value)}
              placeholder={t('splitDialog.titleAPlaceholder')}
              className="w-full text-sm font-medium text-gray-900 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="split-title-b" className="block text-sm font-medium text-gray-700 mb-1">
              {t('splitDialog.titleB')}
            </label>
            <input
              id="split-title-b"
              type="text"
              value={titleB}
              onChange={e => setTitleB(e.target.value)}
              placeholder={t('splitDialog.titleBPlaceholder')}
              className="w-full text-sm font-medium text-gray-900 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400"
            />
          </div>

          {asset.evidence.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t('splitDialog.evidenceAssign', { count: asset.evidence.length })}
              </p>
              {!splitValid && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                  {t('splitDialog.evidenceWarning')}
                </p>
              )}
              <ul className="space-y-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2">
                {asset.evidence.map((item, i) => (
                  <li
                    key={`${item.type}-${item.activityLogId ?? i}`}
                    className="flex items-start gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-400 uppercase font-medium">{item.type}</span>
                      <span className="text-gray-700 ml-2 break-all">{item.summary}</span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setItemTarget(i, 0)}
                        className={`px-2 py-0.5 rounded ${
                          assignTo[i] === 0
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {t('splitDialog.partA')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemTarget(i, 1)}
                        className={`px-2 py-0.5 rounded ${
                          assignTo[i] === 1
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {t('splitDialog.partB')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">{t('splitDialog.evidenceHint')}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirm}
            className="flex-1 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-40"
          >
            {busy ? t('splitDialog.confirming') : t('splitDialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
