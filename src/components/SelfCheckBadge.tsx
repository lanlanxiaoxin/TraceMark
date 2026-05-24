import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { recordMetric } from '@/lib/metrics'

export function SelfCheckBadge(): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    const text = reason.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      await recordMetric('self_check_logged', { reason: text.slice(0, 240) })
      setSaved(true)
      setReason('')
      window.setTimeout(() => {
        setSaved(false)
        setOpen(false)
      }, 1200)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
        aria-label={t('selfCheck.triggerAria')}
      >
        <MessageCircle className="w-3.5 h-3.5" aria-hidden />
        {t('selfCheck.trigger')}
      </button>
    )
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
      onSubmit={e => {
        e.preventDefault()
        void submit()
      }}
    >
      <label htmlFor="self-check-reason" className="sr-only">
        {t('selfCheck.title')}
      </label>
      <input
        id="self-check-reason"
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder={t('selfCheck.placeholder')}
        maxLength={240}
        className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
        autoFocus
      />
      <button
        type="submit"
        disabled={!reason.trim() || busy}
        className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
      >
        {saved ? t('selfCheck.saved') : t('selfCheck.record')}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-gray-500 hover:text-gray-800"
      >
        {t('selfCheck.collapse')}
      </button>
    </form>
  )
}
