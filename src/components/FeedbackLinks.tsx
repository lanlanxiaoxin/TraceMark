import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { openExternalUrl } from '@/lib/shell'

const ISSUES_URL = 'https://github.com/lanlanwork/TraceMark/issues'
const DISCUSSIONS_URL = 'https://github.com/lanlanwork/TraceMark/discussions'

export function FeedbackLinks(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2 text-sm">
      <button
        type="button"
        onClick={() => void openExternalUrl(ISSUES_URL)}
        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 w-fit"
      >
        <ExternalLink className="w-4 h-4 shrink-0" aria-hidden />
        {t('feedback.issues')}
      </button>
      <button
        type="button"
        onClick={() => void openExternalUrl(DISCUSSIONS_URL)}
        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 w-fit"
      >
        <ExternalLink className="w-4 h-4 shrink-0" aria-hidden />
        {t('feedback.discussions')}
      </button>
      <p className="text-xs text-gray-500 leading-relaxed pt-1">
        {t('feedback.betaTrial')}
      </p>
    </div>
  )
}
