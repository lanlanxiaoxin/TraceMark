import { useTranslation } from 'react-i18next'
import type { UploadPreview } from '@/env'

interface UploadPreviewDialogProps {
  preview: UploadPreview | null
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export function UploadPreviewDialog({
  preview,
  confirmLabel,
  onConfirm,
  onCancel,
  busy
}: UploadPreviewDialogProps): JSX.Element | null {
  const { t } = useTranslation()
  if (!preview) return null

  const label = confirmLabel ?? t('uploadPreview.defaultConfirm')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-preview-title"
    >
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 id="upload-preview-title" className="text-lg font-semibold text-gray-900">
            {preview.title}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {preview.lines.map((line, i) => (
            <p
              key={i}
              className={`text-sm ${
                line.kind === 'blocked'
                  ? 'text-red-700 bg-red-50 rounded-lg px-3 py-2'
                  : line.kind === 'warning'
                    ? 'text-amber-800 bg-amber-50 rounded-lg px-3 py-2'
                    : 'text-gray-600'
              }`}
            >
              {line.text}
            </p>
          ))}
          {preview.payloadSummary ? (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">{t('uploadPreview.summary')}</p>
              <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {preview.payloadSummary}
              </pre>
            </div>
          ) : null}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 text-sm rounded-lg border border-gray-200 text-gray-700"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !preview.canProceed}
            className="flex-1 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-40"
          >
            {busy ? t('uploadPreview.generating') : label}
          </button>
        </div>
      </div>
    </div>
  )
}
