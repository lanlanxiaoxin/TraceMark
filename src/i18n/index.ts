import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './locales/zh'
import en from './locales/en'

export const LOCALE_SETTING_KEY = 'ui_locale'

export type AppLocale = 'zh' | 'en'

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value === 'en' ? 'en' : 'zh'
}

export function guessLocaleFromNavigator(): AppLocale {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
    return 'en'
  }
  return 'zh'
}

function applyDocumentLang(lng: AppLocale): void {
  document.documentElement.lang = lng === 'en' ? 'en' : 'zh-CN'
}

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en }
  },
  lng: 'zh',
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
  returnEmptyString: false
})

export async function bootstrapLocale(): Promise<AppLocale> {
  const { getSetting } = await import('@/lib/db')
  const stored = await getSetting(LOCALE_SETTING_KEY)
  const lng =
    stored === 'en' || stored === 'zh' ? normalizeLocale(stored) : guessLocaleFromNavigator()
  await i18n.changeLanguage(lng)
  applyDocumentLang(lng)
  return lng
}

export async function setAppLocale(lng: AppLocale): Promise<void> {
  await i18n.changeLanguage(lng)
  applyDocumentLang(lng)
  const { setSetting } = await import('@/lib/db')
  await setSetting(LOCALE_SETTING_KEY, lng)
}

export function getDateLocaleTag(): string {
  return i18n.language === 'en' ? 'en-US' : 'zh-CN'
}

export { i18n }
export default i18n
