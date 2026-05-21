import { useState, useEffect } from 'react'
import { AppShell, type AppPage } from './components/AppShell'
import { TodayInbox } from './pages/TodayInbox'
import { Projects, type ProjectsIntent } from './pages/Projects'
import { Settings } from './pages/Settings'
import { Timeline } from './pages/Timeline'
import { ReportEditor, type ReportEditorIntent } from './pages/ReportEditor'
import { recordMetric } from '@/lib/metrics'
import { CommandPalette } from '@/components/CommandPalette'

export function App(): JSX.Element {
  const [page, setPage] = useState<AppPage>('today')
  const [projectsIntent, setProjectsIntent] = useState<ProjectsIntent>({})
  const [reportIntent, setReportIntent] = useState<ReportEditorIntent>({})

  useEffect(() => {
    void recordMetric('page_visit', { page })
  }, [page])

  const openProjects = (intent: ProjectsIntent = {}): void => {
    setProjectsIntent(intent)
    setPage('projects')
  }

  const openReports = (intent: ReportEditorIntent = {}): void => {
    setReportIntent(intent)
    setPage('reports')
  }

  const handleCommandNavigate = (next: AppPage, intent?: ProjectsIntent): void => {
    if (intent && (intent.tab !== undefined || intent.projectId !== undefined)) {
      setProjectsIntent(intent)
    }
    setPage(next)
  }

  return (
    <>
      <CommandPalette onNavigate={handleCommandNavigate} />
      <AppShell page={page} onNavigate={setPage}>
      {page === 'today' && (
        <TodayInbox
          onNavigateProjects={() => openProjects({ tab: 'spaces' })}
          onOpenProjects={openProjects}
        />
      )}
      {page === 'projects' && (
        <Projects
          intent={projectsIntent}
          onIntentConsumed={() => setProjectsIntent({})}
          onOpenReports={openReports}
        />
      )}
      {page === 'timeline' && <Timeline />}
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
