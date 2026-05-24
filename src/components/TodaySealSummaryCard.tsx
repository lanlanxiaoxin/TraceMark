import { useTranslation } from 'react-i18next'
import { FileText, CheckCircle2 } from 'lucide-react'
import type { TodaySealResult } from '@/lib/todaySeal'
import { ReportMarkdownView } from '@/components/ReportMarkdownView'
import { getDateLocaleTag } from '@/i18n'

interface TodaySealSummaryCardProps {
  result: TodaySealResult
  onOpenReport?: () => void
  onSealAgain?: () => void
}

export function TodaySealSummaryCard({
  result,
  onOpenReport,
  onSealAgain
}: TodaySealSummaryCardProps): JSX.Element {
  const { t } = useTranslation()
  const dateLabel = new Date(result.dateMs).toLocaleDateString(getDateLocaleTag(), {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })

  const mainlineText = result.skippedMainline
    ? t('today.sealNoMainline')
    : result.projectName
      ? t('today.sealMainline', {
          name: result.projectName,
          task: result.taskHint ? ` · ${result.taskHint}` : ''
        })
      : result.parsedProjectLabel
        ? t('today.sealMainlineParsed', { label: result.parsedProjectLabel })
        : t('today.sealMainlineRecorded')

  return (
    <section
      className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white p-5 space-y-4 shadow-sm"
      aria-label={t('today.sealSummaryAria')}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden />
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('today.sealSummaryDone', { date: dateLabel })}
          </h2>
          <p className="text-sm text-gray-600">{mainlineText}</p>
          {result.note.trim() && (
            <p className="text-sm text-gray-800 border-l-2 border-emerald-300 pl-3 mt-2">
              {result.note.trim()}
            </p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white/80 border border-gray-100 py-2">
          <dt className="text-gray-500">{t('today.sealStatsSuggested')}</dt>
          <dd className="text-base font-semibold text-gray-900">{result.evidenceSuggested}</dd>
        </div>
        <div className="rounded-lg bg-white/80 border border-gray-100 py-2">
          <dt className="text-gray-500">{t('today.sealStatsArchived')}</dt>
          <dd className="text-base font-semibold text-gray-900">{result.evidenceArchived}</dd>
        </div>
        <div className="rounded-lg bg-white/80 border border-gray-100 py-2">
          <dt className="text-gray-500">{t('today.sealStatsIgnored')}</dt>
          <dd className="text-base font-semibold text-gray-900">{result.evidenceDismissed}</dd>
        </div>
      </dl>

      {result.reportContent && (
        <div className="space-y-2 border-t border-emerald-100 pt-3">
          <p className="text-xs font-medium text-gray-600">
            {t('today.sealDraftReport')}
            {result.reportMode === 'offline' ? t('today.sealDraftOffline') : ''}
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 bg-white p-3 text-sm">
            <ReportMarkdownView content={result.reportContent.slice(0, 1200)} />
            {result.reportContent.length > 1200 && (
              <p className="text-xs text-gray-400 mt-2">{t('today.sealDraftMore')}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {onOpenReport && (
          <button
            type="button"
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          >
            <FileText className="w-4 h-4" aria-hidden />
            {t('today.sealOpenReport')}
          </button>
        )}
        {onSealAgain && (
          <button
            type="button"
            onClick={onSealAgain}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            {t('today.sealAgain')}
          </button>
        )}
      </div>
    </section>
  )
}
