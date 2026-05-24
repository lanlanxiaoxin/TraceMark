import type { ActivityCategory } from '@/env'
import i18n from '@/i18n'

export const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  code_editor: 'bg-violet-100 text-violet-800',
  terminal: 'bg-slate-100 text-slate-800',
  browser: 'bg-sky-100 text-sky-800',
  design: 'bg-pink-100 text-pink-800',
  docs: 'bg-amber-100 text-amber-800',
  communication: 'bg-green-100 text-green-800',
  meeting: 'bg-orange-100 text-orange-800',
  file_manager: 'bg-gray-100 text-gray-700',
  other: 'bg-gray-100 text-gray-600'
}

export function getCategoryLabel(category: ActivityCategory | null | undefined): string {
  if (!category) return i18n.t('category.other')
  const key = `category.${category}` as const
  return i18n.t(key, { defaultValue: i18n.t('category.other') })
}

export function getCategoryColor(category: ActivityCategory | null | undefined): string {
  if (!category) return CATEGORY_COLORS.other
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other
}
