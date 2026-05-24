import { getSetting, setSetting } from '@/lib/db'

const ONBOARDING_KEY = 'onboarding_completed'
const ONBOARDING_VERSION_KEY = 'onboarding_version'

export async function isOnboardingCompleted(): Promise<boolean> {
  const v = await getSetting(ONBOARDING_KEY)
  return v === 'true'
}

export async function completeOnboarding(version = '0.2.0'): Promise<void> {
  await setSetting(ONBOARDING_KEY, 'true')
  await setSetting(ONBOARDING_VERSION_KEY, version)
}
