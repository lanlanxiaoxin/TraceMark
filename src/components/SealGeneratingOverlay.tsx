import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

export type SealOverlayPhase = 'seal' | 'report'

interface SealGeneratingOverlayProps {
  phase: SealOverlayPhase
}

export function SealGeneratingOverlay({ phase }: SealGeneratingOverlayProps): JSX.Element {
  const { t } = useTranslation()
  const copy =
    phase === 'seal'
      ? {
          title: t('today.sealOverlaySavingTitle'),
          subtitle: t('today.sealOverlaySavingSub'),
          hint: t('today.sealOverlaySavingHint')
        }
      : {
          title: t('today.sealOverlayReportTitle'),
          subtitle: t('today.sealOverlayReportSub'),
          hint: t('today.sealOverlayReportHint')
        }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-gray-900/45 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-sm w-full rounded-2xl bg-white shadow-xl border border-gray-200 p-8 text-center space-y-3">
        <Loader2 className="w-10 h-10 text-gray-800 animate-spin mx-auto" aria-hidden />
        <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
        <p className="text-sm text-gray-600">{copy.subtitle}</p>
        <p className="text-xs text-gray-400">{copy.hint}</p>
      </div>
    </div>
  )
}
