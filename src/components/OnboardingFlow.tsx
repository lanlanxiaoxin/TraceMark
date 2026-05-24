import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronRight, Shield, Stamp } from 'lucide-react'
import { ProjectSpaceWizard, type ProjectWizardSaveData } from '@/components/ProjectSpaceWizard'
import { saveProjectAliases } from '@/components/ProjectSpaceForm'
import { createProjectSpace } from '@/lib/projectSpaces'
import { setSetting } from '@/lib/db'
import { setPrivacyConsent, PRIVACY_CAPABILITIES } from '@/lib/privacy'
import { completeOnboarding } from '@/lib/onboarding'

interface OnboardingFlowProps {
  onComplete: () => void
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps): JSX.Element {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [monitoring, setMonitoring] = useState(true)
  const [cloudBasic, setCloudBasic] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = useMemo(
    () =>
      [
        { id: 1, titleKey: 'onboarding.stepProject', icon: Stamp },
        { id: 2, titleKey: 'onboarding.stepPrivacy', icon: Shield },
        { id: 3, titleKey: 'onboarding.stepStart', icon: CheckCircle2 }
      ] as const,
    []
  )

  const handleProjectSave = async (data: ProjectWizardSaveData): Promise<void> => {
    setError(null)
    const created = await createProjectSpace({
      name: data.name,
      roleTemplate: data.roleTemplate
    })
    await saveProjectAliases(created.id, data)
    setProjectName(data.name)
    setStep(2)
  }

  const applyPrivacyStep = async (): Promise<void> => {
    await setSetting('process_monitoring_enabled', monitoring ? 'true' : 'false')
    await setPrivacyConsent('global', null, PRIVACY_CAPABILITIES.L1_CLOUD, cloudBasic)
    setStep(3)
  }

  const finish = async (): Promise<void> => {
    setFinishing(true)
    setError(null)
    try {
      await completeOnboarding()
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.finishError'))
      setFinishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-gray-50 overflow-y-auto">
      <div className="min-h-full flex flex-col">
        <header className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="max-w-xl mx-auto">
            <p className="text-xs font-medium text-indigo-600 tracking-wide">{t('onboarding.badge')}</p>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{t('onboarding.headline')}</h1>
            <ol className="flex gap-2 mt-4" aria-label={t('onboarding.stepsAria')}>
              {steps.map(s => {
                const Icon = s.icon
                const active = step === s.id
                const done = step > s.id
                return (
                  <li
                    key={s.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium ${
                      active
                        ? 'bg-gray-900 text-white'
                        : done
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    {t(s.titleKey)}
                  </li>
                )
              })}
            </ol>
          </div>
        </header>

        <main className="flex-1 max-w-xl mx-auto w-full px-6 py-8">
          {error ? (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          ) : null}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{t('onboarding.step1Intro')}</p>
              <ProjectSpaceWizard onSave={handleProjectSave} onCancel={() => setStep(2)} />
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full text-sm text-gray-500 hover:text-gray-800 underline"
              >
                {t('onboarding.skipProject')}
              </button>
            </div>
          )}

          {step === 2 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
              <p className="text-sm text-gray-600">
                {projectName
                  ? t('onboarding.step2IntroNamed', { name: projectName })
                  : t('onboarding.step2Intro')}
              </p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={monitoring}
                  onChange={e => setMonitoring(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {t('onboarding.enableMonitoring')}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">{t('onboarding.enableMonitoringHint')}</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cloudBasic}
                  onChange={e => setCloudBasic(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{t('onboarding.enableCloud')}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{t('onboarding.enableCloudHint')}</p>
                </div>
              </label>

              <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                {t('onboarding.privacyFootnote')}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600"
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  onClick={() => void applyPrivacyStep()}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-gray-900 text-white"
                >
                  {t('common.continue')}
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" aria-hidden />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">{t('onboarding.step3Title')}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{t('onboarding.step3Body')}</p>
              </div>
              <ul className="text-left text-sm text-gray-600 space-y-2 bg-gray-50 rounded-lg p-4">
                <li>{t('onboarding.tip1')}</li>
                <li>{t('onboarding.tip2')}</li>
                <li>{t('onboarding.tip3')}</li>
              </ul>
              <button
                type="button"
                disabled={finishing}
                onClick={() => void finish()}
                className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-50"
              >
                {finishing ? t('onboarding.entering') : t('onboarding.enterApp')}
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
