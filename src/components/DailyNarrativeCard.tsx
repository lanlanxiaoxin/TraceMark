import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import type { UploadPreview } from '@/env'
import { getDailyNarrative, generateDailyNarrativeAi } from '@/lib/dailyNarrative'
import { buildDailyNarrativeUploadPreview } from '@/lib/uploadPreview'
import { useSettings } from '@/hooks/useSettings'
import { UploadPreviewDialog } from '@/components/UploadPreviewDialog'

interface DailyNarrativeCardProps {
  dateMs: number
}

export function DailyNarrativeCard({ dateMs }: DailyNarrativeCardProps): JSX.Element {
  const { t } = useTranslation()
  const { settings, updateSetting, loading: settingsLoading } = useSettings()
  const useAiPreferred = settings.daily_narrative_use_ai === 'true'

  const [fullText, setFullText] = useState<string | null>(null)
  const [displayed, setDisplayed] = useState('')
  const [loadingText, setLoadingText] = useState(true)
  const [busyAi, setBusyAi] = useState(false)
  const [lastMode, setLastMode] = useState<'offline' | 'ai'>('offline')
  const [degraded, setDegraded] = useState<string | null>(null)
  const [preview, setPreview] = useState<UploadPreview | null>(null)

  const loadOffline = useCallback(async (): Promise<void> => {
    setLoadingText(true)
    setDegraded(null)
    setLastMode('offline')
    try {
      const narrative = await getDailyNarrative(dateMs)
      setFullText(narrative)
    } finally {
      setLoadingText(false)
    }
  }, [dateMs])

  useEffect(() => {
    void loadOffline()
  }, [dateMs, loadOffline])

  useEffect(() => {
    if (!fullText) return
    setDisplayed('')
    let i = 0
    const step = 3
    const id = window.setInterval(() => {
      i += step
      setDisplayed(fullText.slice(0, Math.min(i, fullText.length)))
      if (i >= fullText.length) window.clearInterval(id)
    }, 16)
    return () => window.clearInterval(id)
  }, [fullText])

  const openAiPreview = async (): Promise<void> => {
    setDegraded(null)
    try {
      setPreview(await buildDailyNarrativeUploadPreview(dateMs))
    } catch (e) {
      setDegraded(e instanceof Error ? e.message : t('dailyNarrative.errPreview'))
    }
  }

  const runAiGenerate = async (): Promise<void> => {
    setPreview(null)
    setBusyAi(true)
    setDegraded(null)
    try {
      const res = await generateDailyNarrativeAi(dateMs)
      setFullText(res.content)
      setLastMode(res.mode === 'ai' ? 'ai' : 'offline')
      if (res.degradedFromAi && res.degradationReason) {
        setDegraded(res.degradationReason)
      }
    } catch (e) {
      setDegraded(e instanceof Error ? e.message : t('common.errGenerate'))
    } finally {
      setBusyAi(false)
    }
  }

  const setModeOffline = (): void => {
    void updateSetting('daily_narrative_use_ai', 'false')
    void loadOffline()
  }

  const setModeAi = (): void => {
    void updateSetting('daily_narrative_use_ai', 'true')
  }

  if (settingsLoading) {
    return (
      <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 animate-pulse min-h-[120px]" />
    )
  }

  return (
    <>
      <section
        className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 to-white p-4 space-y-3 shadow-sm"
        aria-label={t('dailyNarrative.aria')}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-600" aria-hidden />
            {t('dailyNarrative.title')}
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-700/80">
            {lastMode === 'ai' ? t('dailyNarrative.modeAi') : t('dailyNarrative.modeOffline')}
          </span>
        </div>

        <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 w-fit">
          <button
            type="button"
            onClick={setModeOffline}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              !useAiPreferred ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t('dailyNarrative.modeOffline')}
          </button>
          <button
            type="button"
            onClick={setModeAi}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              useAiPreferred ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t('dailyNarrative.modeAi')}
          </button>
        </div>

        {loadingText ? (
          <p className="text-xs text-gray-500 animate-pulse">{t('dailyNarrative.aggregating')}</p>
        ) : (
          <p className="text-sm text-gray-800 leading-relaxed min-h-[4.5rem] whitespace-pre-wrap">
            {displayed}
            {fullText && displayed.length < fullText.length ? (
              <span className="inline-block w-2 h-4 ml-0.5 bg-indigo-400/70 animate-pulse align-middle" />
            ) : null}
          </p>
        )}

        {degraded && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {degraded}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void loadOffline()}
            disabled={loadingText || busyAi}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingText ? 'animate-spin' : ''}`} />
            {t('dailyNarrative.refreshOffline')}
          </button>
          {useAiPreferred && (
            <button
              type="button"
              onClick={() => void openAiPreview()}
              disabled={loadingText || busyAi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {t('dailyNarrative.uploadPreviewGenerate')}
            </button>
          )}
        </div>

        <p className="text-[10px] text-gray-400">{t('dailyNarrative.footnote')}</p>
      </section>

      <UploadPreviewDialog
        preview={preview}
        confirmLabel={t('dailyNarrative.confirmAi')}
        onConfirm={() => void runAiGenerate()}
        onCancel={() => setPreview(null)}
        busy={busyAi}
      />
    </>
  )
}
