import type { ActivityLog } from '@/lib/activityLogs'
import { formatDayLabel } from '@/lib/activityLogs'
import { TimelineItem } from './TimelineItem'

interface DayGroupProps {
  dayTimestamp: number
  logs: ActivityLog[]
  onItemDeleted?: (id: number) => void
}

export function DayGroup({ dayTimestamp, logs, onItemDeleted }: DayGroupProps): JSX.Element {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-500 px-1">
        {formatDayLabel(dayTimestamp)}
        <span className="font-normal text-gray-400 ml-2">{logs.length} 条</span>
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {logs.map(log => (
          <TimelineItem key={log.id} log={log} onDeleted={onItemDeleted} />
        ))}
      </div>
    </section>
  )
}
