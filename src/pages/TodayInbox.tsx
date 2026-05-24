import { useState } from 'react'
import { TodaySealFlow } from '@/components/TodaySealFlow'
import { SelfCheckBadge } from '@/components/SelfCheckBadge'
import { TodayClassicInbox } from '@/pages/TodayClassicInbox'
import { getTodayInboxMode, setTodayInboxMode, type TodayInboxMode } from '@/lib/todaySeal'
import type { ProjectsIntent } from '@/pages/Projects'
import type { TimelineIntent } from '@/env'

interface TodayInboxProps {
  onNavigateProjects?: () => void
  onOpenProjects?: (intent: ProjectsIntent) => void
  onOpenTimeline?: (intent: TimelineIntent) => void
  onOpenReports?: (dateMs: number) => void
}

export function TodayInbox({
  onNavigateProjects,
  onOpenProjects,
  onOpenTimeline,
  onOpenReports
}: TodayInboxProps): JSX.Element {
  const [mode, setMode] = useState<TodayInboxMode>(() => getTodayInboxMode())

  const switchMode = (next: TodayInboxMode): void => {
    setTodayInboxMode(next)
    setMode(next)
  }

  return (
    <div className="space-y-3">
      <div className="max-w-2xl mx-auto px-6 pt-4 flex justify-end">
        <SelfCheckBadge />
      </div>

      {mode === 'seal' ? (
        <TodaySealFlow
          onNavigateProjects={onNavigateProjects}
          onOpenProjects={onOpenProjects}
          onOpenTimeline={onOpenTimeline}
          onSwitchClassic={() => switchMode('classic')}
          onOpenReports={onOpenReports}
        />
      ) : (
        <TodayClassicInbox
          onNavigateProjects={onNavigateProjects}
          onOpenProjects={onOpenProjects}
          onOpenTimeline={onOpenTimeline}
          onSwitchSeal={() => switchMode('seal')}
        />
      )}
    </div>
  )
}
