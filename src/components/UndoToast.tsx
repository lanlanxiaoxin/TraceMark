import { useEffect } from 'react'
import { X } from 'lucide-react'

export interface UndoToastState {
  message: string
  onUndo: () => void | Promise<void>
}

interface UndoToastProps {
  toast: UndoToastState | null
  onDismiss: () => void
  durationMs?: number
}

export function UndoToast({
  toast,
  onDismiss,
  durationMs = 5000
}: UndoToastProps): JSX.Element | null {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss, durationMs])

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-xl bg-gray-900 text-white shadow-lg shadow-black/25 text-sm max-w-[min(100vw-2rem,24rem)]"
    >
      <span className="flex-1 truncate">{toast.message}</span>
      <button
        type="button"
        onClick={() => void toast.onUndo()}
        className="shrink-0 font-medium text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg hover:bg-white/10"
      >
        撤销
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
        aria-label="关闭"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
