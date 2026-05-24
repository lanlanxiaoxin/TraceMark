import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPrivacyConsent, setPrivacyConsent, PRIVACY_CAPABILITIES } from '@/lib/privacy'

interface PrivacyConsentPanelProps {
  scopeType?: 'global' | 'project'
  projectId?: number | null
  compact?: boolean
}

export function PrivacyConsentPanel({
  scopeType = 'global',
  projectId = null,
  compact = false
}: PrivacyConsentPanelProps): JSX.Element {
  const { t } = useTranslation()
  const scopeId = scopeType === 'project' && projectId != null ? String(projectId) : null
  const [basic, setBasic] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, b] = await Promise.all([
        getPrivacyConsent(scopeType, scopeId, PRIVACY_CAPABILITIES.L1_CLOUD),
        getPrivacyConsent(scopeType, scopeId, PRIVACY_CAPABILITIES.L2_ENHANCED)
      ])
      setBasic(a?.enabled ?? false)
      setEnhanced(b?.enabled ?? false)
    } finally {
      setLoading(false)
    }
  }, [scopeType, scopeId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (cap: string, value: boolean, setter: (v: boolean) => void): Promise<void> => {
    setter(value)
    await setPrivacyConsent(
      scopeType,
      scopeId,
      cap as typeof PRIVACY_CAPABILITIES.L1_CLOUD,
      value
    )
  }

  if (loading) {
    return <p className="text-sm text-gray-400">{t('privacyDetail.consentLoading')}</p>
  }

  const row = (
    id: string,
    label: string,
    desc: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    disabled?: boolean
  ) => (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => void onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300"
      />
      <span>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
      </span>
    </label>
  )

  return (
    <section className={compact ? 'space-y-3' : 'bg-white rounded-xl border border-gray-200 p-6 space-y-4'}>
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('privacyDetail.consentTitle')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('privacyDetail.consentSubtitle')}</p>
        </div>
      )}
      {row(
        'cap-local',
        t('privacyDetail.localBase'),
        t('privacyDetail.localBaseHint'),
        true,
        () => {},
        true
      )}
      {row('cap-basic', t('privacyDetail.basicCloud'), t('privacyDetail.basicCloudHint'), basic, v =>
        void toggle(PRIVACY_CAPABILITIES.L1_CLOUD, v, setBasic)
      )}
      {row(
        'cap-enhanced',
        t('privacyDetail.enhanced'),
        t('privacyDetail.enhancedHint'),
        enhanced,
        v => void toggle(PRIVACY_CAPABILITIES.L2_ENHANCED, v, setEnhanced)
      )}
    </section>
  )
}
