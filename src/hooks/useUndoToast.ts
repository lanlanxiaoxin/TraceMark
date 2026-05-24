import { useCallback, useRef, useState } from 'react'
import i18n from '@/i18n'

export interface UndoToastState {
  message: string
  onUndo: () => void | Promise<void>
}
export function useUndoToast(): {
  toast: UndoToastState | null
  showUndo: (message: string, onUndo: () => void | Promise<void>) => void
  dismiss: () => void
} {
  const [toast, setToast] = useState<UndoToastState | null>(null)
  const busyRef = useRef(false)

  const dismiss = useCallback(() => {
    setToast(null)
    busyRef.current = false
  }, [])

  const showUndo = useCallback(
    (message: string, onUndo: () => void | Promise<void>) => {
      setToast({
        message,
        onUndo: async () => {
          if (busyRef.current) return
          busyRef.current = true
          try {
            await onUndo()
            dismiss()
          } catch (e) {
            console.error('[undo]', e)
            setToast({
              message: i18n.t('common.undoFailed'),
              onUndo: async () => {
                busyRef.current = false
                await onUndo()
                dismiss()
              }
            })
            busyRef.current = false
          }
        }
      })
    },
    [dismiss]
  )

  return { toast, showUndo, dismiss }
}
