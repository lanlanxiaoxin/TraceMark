import { getDb } from './database'
import zh from '../src/i18n/locales/zh'
import en from '../src/i18n/locales/en'

export function getUiLocaleSync(): 'zh' | 'en' {
  try {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ui_locale') as
      | { value: string }
      | undefined
    if (row?.value === 'en') return 'en'
    if (row?.value === 'zh') return 'zh'
  } catch {
    /* db not ready */
  }
  return 'zh'
}

export function tElectron(key: string, vars?: Record<string, string | number>): string {
  const bundle = getUiLocaleSync() === 'en' ? en : zh
  const parts = key.split('.')
  let node: unknown = bundle
  for (const p of parts) {
    if (node == null || typeof node !== 'object') {
      node = undefined
      break
    }
    node = (node as Record<string, unknown>)[p]
  }
  let text = typeof node === 'string' ? node : key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{{${k}}}`, String(v))
    }
  }
  return text
}
