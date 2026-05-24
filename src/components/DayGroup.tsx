import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActivityLog } from '@/lib/activityLogs'
import { formatDayLabel } from '@/lib/activityLogs'
import { TimelineItem } from './TimelineItem'

interface DayGroupProps {
  dayTimestamp: number
  logs: ActivityLog[]
  onItemDeleted?: (id: number) => void
  highlightLogId?: number | null
  highlightRef?: RefObject<HTMLDivElement>
}

export function DayGroup({
  dayTimestamp,
  logs,
  onItemDeleted,
  highlightLogId,
  highlightRef
}: DayGroupProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-500 px-1">
        {formatDayLabel(dayTimestamp)}
        <span className="font-normal text-gray-400 ml-2">
          {t('timeline.entryCount', { count: logs.length })}
        </span>
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {logs.map(log => {
          const highlighted = highlightLogId != null && log.id === highlightLogId
          return (
            <div
              key={log.id}
              ref={highlighted ? highlightRef : undefined}
              data-timeline-highlight={highlighted ? 'true' : undefined}
            >
              <TimelineItem log={log} onDeleted={onItemDeleted} highlighted={highlighted} />
            </div>
          )
        })}
      </div>
    </section>
  )
}
