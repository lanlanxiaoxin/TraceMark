import { useTranslation } from 'react-i18next'
import { setAppLocale, type AppLocale } from '@/i18n'

const OPTIONS: Array<{ value: AppLocale; labelKey: 'settings.language.zh' | 'settings.language.en' }> =
  [
    { value: 'zh', labelKey: 'settings.language.zh' },
    { value: 'en', labelKey: 'settings.language.en' }
  ]

export function LanguageSettings(): JSX.Element {
  const { t, i18n } = useTranslation()
  const current: AppLocale = i18n.language === 'en' ? 'en' : 'zh'

  const onChange = (lng: AppLocale): void => {
    void setAppLocale(lng)
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('settings.language.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('settings.language.description')}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
              current === opt.value
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </section>
  )
}
