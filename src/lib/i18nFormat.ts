import i18n from '@/i18n'
import { getDateLocaleTag } from '@/i18n'

function startOfDayMs(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 今日页日期条：今天 / 昨天 / 月日周 */
export function formatInboxDateLabel(ms: number, now = Date.now()): string {
  const today = startOfDayMs(now)
  const target = startOfDayMs(ms)
  if (target === today) return i18n.t('common.today')
  if (target === today - 86400000) return i18n.t('common.yesterday')
  return new Date(ms).toLocaleDateString(getDateLocaleTag(), {
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  })
}

/** 命令面板等：今天 / 昨天 / 月日 */
export function formatShortDayLabel(ts: number, now = Date.now()): string {
  const today = startOfDayMs(now)
  const day = startOfDayMs(ts)
  if (day === today) return i18n.t('common.today')
  if (day === today - 86400000) return i18n.t('common.yesterday')
  return new Date(ts).toLocaleDateString(getDateLocaleTag(), { month: 'short', day: 'numeric' })
}
