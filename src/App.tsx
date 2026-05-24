import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AppShell, type AppPage } from './components/AppShell'
import { OnboardingFlow } from './components/OnboardingFlow'
import { isOnboardingCompleted } from '@/lib/onboarding'
import { TodayInbox } from './pages/TodayInbox'
import { Projects, type ProjectsIntent } from './pages/Projects'
import { Settings } from './pages/Settings'
import { Timeline } from './pages/Timeline'
import { ReportEditor, type ReportEditorIntent } from './pages/ReportEditor'
import type { TimelineIntent } from '@/env'
import { recordMetric } from '@/lib/metrics'
import { CommandPalette } from '@/components/CommandPalette'

export function App(): JSX.Element {
  const { t } = useTranslation()
  const [page, setPage] = useState<AppPage>('today')
  const [projectsIntent, setProjectsIntent] = useState<ProjectsIntent>({})
  const [reportIntent, setReportIntent] = useState<ReportEditorIntent>({})
  const [timelineIntent, setTimelineIntent] = useState<TimelineIntent>({})
  const [onboardingReady, setOnboardingReady] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    void isOnboardingCompleted().then(done => {
      setShowOnboarding(!done)
      setOnboardingReady(true)
    })
  }, [])

  useEffect(() => {
    if (!onboardingReady || showOnboarding) return
    void recordMetric('page_visit', { page })
  }, [page, onboardingReady, showOnboarding])

  useEffect(() => {
    if (!onboardingReady || showOnboarding) return
    return window.electronAPI.onAppNavigate(payload => {
      if (payload.page === 'reports') {
        setReportIntent(payload.intent)
        setPage('reports')
      }
    })
  }, [onboardingReady, showOnboarding])

  if (!onboardingReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
  }

  const openProjects = (intent: ProjectsIntent = {}): void => {
    setProjectsIntent(intent)
    setPage('projects')
  }

  const openReports = (intent: ReportEditorIntent = {}): void => {
    setReportIntent(intent)
    setPage('reports')
  }

  const openTimeline = (intent: TimelineIntent): void => {
    setTimelineIntent(intent)
    setPage('timeline')
  }

  const handleCommandNavigate = (next: AppPage, intent?: ProjectsIntent): void => {
    if (intent && (intent.tab !== undefined || intent.projectId !== undefined)) {
      setProjectsIntent(intent)
    }
    setPage(next)
  }

  return (
    <>
      <CommandPalette onNavigate={handleCommandNavigate} onOpenTimeline={openTimeline} />
      <AppShell page={page} onNavigate={setPage}>
      {page === 'today' && (
        <TodayInbox
          onNavigateProjects={() => openProjects({ tab: 'spaces' })}
          onOpenProjects={openProjects}
          onOpenTimeline={openTimeline}
          onOpenReports={dateMs => {
            setReportIntent({ type: 'daily', dateMs })
            setPage('reports')
          }}
        />
      )}
      {page === 'projects' && (
        <Projects
          intent={projectsIntent}
          onIntentConsumed={() => setProjectsIntent({})}
          onOpenReports={openReports}
          onOpenTimeline={openTimeline}
        />
      )}
      {page === 'timeline' && (
        <Timeline intent={timelineIntent} onIntentConsumed={() => setTimelineIntent({})} />
      )}
      {page === 'reports' && (
        <ReportEditor
          intent={reportIntent}
          onIntentConsumed={() => setReportIntent({})}
          onOpenProjects={openProjects}
        />
      )}
      {page === 'settings' && <Settings />}
    </AppShell>
    </>
  )
}
