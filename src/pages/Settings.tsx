import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/hooks/useSettings'
import { LanguageSettings } from '@/components/LanguageSettings'
import { AiSettingsSection } from '@/components/AiSettingsSection'
import { PrivacySettings } from '@/components/PrivacySettings'
import { PrivacyConsentPanel } from '@/components/PrivacyConsentPanel'
import { ActivityProviderSection } from '@/components/ActivityProviderSection'
import { CategorySettings } from '@/components/CategorySettings'
import { MetricsDashboardSection } from '@/components/MetricsDashboardSection'
import { FeedbackLinks } from '@/components/FeedbackLinks'
import { getAppVersion, setSetting } from '@/lib/db'

type SettingsTab =
  | 'capture'
  | 'notify'
  | 'privacy'
  | 'ai'
  | 'advanced'
  | 'about'
  | 'language'

const TAB_IDS: SettingsTab[] = [
  'capture',
  'notify',
  'privacy',
  'ai',
  'advanced',
  'language',
  'about'
]

export function Settings(): JSX.Element {
  const { t } = useTranslation()
  const { settings, loading, savingKey, updateSetting } = useSettings()

  const pollIntervals = useMemo(
    () => [
      { value: '3', label: t('settings.capture.poll3') },
      { value: '5', label: t('settings.capture.poll5') },
      { value: '10', label: t('settings.capture.poll10') }
    ],
    [t]
  )

  const settingsTabs = useMemo(
    () =>
      TAB_IDS.map(id => ({
        id,
        label: t(`settings.tabs.${id}.label`),
        description: t(`settings.tabs.${id}.description`)
      })),
    [t]
  )
  const [tab, setTab] = useState<SettingsTab>('capture')
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    void getAppVersion().then(setAppVersion)
  }, [])

  const activeMeta = settingsTabs.find(item => item.id === tab)!

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        {t('common.loadingShort')}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('settings.subtitle')}</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-6">
        <nav
          className="sm:w-44 shrink-0 flex sm:flex-col gap-1 overflow-x-auto pb-1 sm:pb-0"
          role="tablist"
          aria-label={t('settings.tabList')}
        >
          {settingsTabs.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`shrink-0 sm:w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                tab === item.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span
                className={`hidden sm:block text-[11px] mt-0.5 leading-snug ${
                  tab === item.id ? 'text-gray-300' : 'text-gray-400'
                }`}
              >
                {item.description}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-4" role="tabpanel">
          <div className="sm:hidden">
            <p className="text-xs text-gray-500">{activeMeta.description}</p>
          </div>

          {tab === 'capture' && (
            <>
              <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('settings.capture.title')}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{t('settings.capture.subtitle')}</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.process_monitoring_enabled !== 'false'}
                    onChange={e =>
                      updateSetting(
                        'process_monitoring_enabled',
                        e.target.checked ? 'true' : 'false'
                      )
                    }
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {t('settings.capture.enableMonitoring')}
                    </span>
                    <p className="text-xs text-gray-500">{t('settings.capture.enableMonitoringHint')}</p>
                  </div>
                </label>

                <div>
                  <label
                    htmlFor="poll-interval"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('settings.capture.pollInterval')}
                  </label>
                  <select
                    id="poll-interval"
                    value={settings.poll_interval_seconds || '5'}
                    onChange={e => updateSetting('poll_interval_seconds', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {pollIntervals.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-gray-400">{t('settings.capture.footnote')}</p>
              </section>

              <CategorySettings settings={settings} updateSetting={updateSetting} />
              <ActivityProviderSection />
            </>
          )}

          {tab === 'notify' && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('settings.notify.title')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.notify.subtitle')}</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.daily_reminder_enabled !== 'false'}
                  onChange={e =>
                    updateSetting('daily_reminder_enabled', e.target.checked ? 'true' : 'false')
                  }
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">
                    {t('settings.notify.dailyReminder')}
                  </span>
                  <p className="text-xs text-gray-500">{t('settings.notify.dailyReminderHint')}</p>
                </div>
                <input
                  type="time"
                  value={settings.daily_reminder_time || '18:00'}
                  onChange={e => updateSetting('daily_reminder_time', e.target.value)}
                  disabled={settings.daily_reminder_enabled === 'false'}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                />
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.friday_reminder_enabled !== 'false'}
                  onChange={e =>
                    updateSetting(
                      'friday_reminder_enabled',
                      e.target.checked ? 'true' : 'false'
                    )
                  }
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">
                    {t('settings.notify.fridayReminder')}
                  </span>
                  <p className="text-xs text-gray-500">{t('settings.notify.fridayReminderHint')}</p>
                </div>
                <input
                  type="time"
                  value={settings.friday_reminder_time || '17:00'}
                  onChange={e => updateSetting('friday_reminder_time', e.target.value)}
                  disabled={settings.friday_reminder_enabled === 'false'}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                />
              </label>
            </section>
          )}

          {tab === 'privacy' && (
            <>
              <PrivacySettings settings={settings} updateSetting={updateSetting} />
              <PrivacyConsentPanel />
            </>
          )}

          {tab === 'ai' && (
            <>
              <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('settings.aiNarrative.title')}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{t('settings.aiNarrative.subtitle')}</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.daily_narrative_use_ai === 'true'}
                    onChange={e =>
                      updateSetting('daily_narrative_use_ai', e.target.checked ? 'true' : 'false')
                    }
                    disabled={savingKey === 'daily_narrative_use_ai'}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {t('settings.aiNarrative.enableAi')}
                    </span>
                    <p className="text-xs text-gray-500">{t('settings.aiNarrative.enableAiHint')}</p>
                  </div>
                </label>
              </section>

              <AiSettingsSection
                settings={settings}
                savingKey={savingKey}
                updateSetting={updateSetting}
              />
            </>
          )}

          {tab === 'advanced' && <MetricsDashboardSection />}

          {tab === 'language' && <LanguageSettings />}

          {tab === 'about' && (
            <>
              <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('settings.about.feedbackTitle')}
                </h2>
                <p className="text-sm text-gray-500">{t('settings.about.feedbackBody')}</p>
                <FeedbackLinks />
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('settings.about.aboutTitle')}
                </h2>
                <p className="text-sm text-gray-500">
                  TraceMark {appVersion ? `v${appVersion}` : ''} · {t('settings.about.tagline')}
                </p>
                <p className="text-xs text-gray-400">{t('settings.about.subtitle')}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('settings.about.rerunOnboardingConfirm'))) {
                      void setSetting('onboarding_completed', 'false').then(() => {
                        window.location.reload()
                      })
                    }
                  }}
                  className="text-xs text-gray-500 underline hover:text-gray-800"
                >
                  {t('settings.about.rerunOnboarding')}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
