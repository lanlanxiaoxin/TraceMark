import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { UndoToastState } from '@/hooks/useUndoToast'

interface UndoToastProps {
  toast: UndoToastState | null
  onDismiss: () => void
}

export function UndoToast({ toast, onDismiss }: UndoToastProps): JSX.Element | null {
  const { t } = useTranslation()
  if (!toast) return null

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-xl bg-gray-900 text-white shadow-lg shadow-black/25 text-sm max-w-[min(100vw-2rem,24rem)]"
      role="status"
    >
      <span className="flex-1 min-w-0 truncate">{toast.message}</span>
      <button
        type="button"
        onClick={toast.onUndo}
        className="shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-medium"
      >
        {t('common.undo')}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-lg hover:bg-white/15"
        aria-label={t('common.close')}
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  )
}
