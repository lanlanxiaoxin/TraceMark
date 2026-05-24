import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox, FolderKanban, Clock, FileText, Settings } from 'lucide-react'

export type AppPage = 'today' | 'projects' | 'timeline' | 'reports' | 'settings'

interface AppShellProps {
  page: AppPage
  onNavigate: (page: AppPage) => void
  children: ReactNode
}

const NAV: { id: AppPage; labelKey: string; icon: typeof Inbox }[] = [
  { id: 'today', labelKey: 'nav.today', icon: Inbox },
  { id: 'projects', labelKey: 'nav.projects', icon: FolderKanban },
  { id: 'timeline', labelKey: 'nav.timeline', icon: Clock },
  { id: 'reports', labelKey: 'nav.reports', icon: FileText },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings }
]

export function AppShell({ page, onNavigate, children }: AppShellProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 antialiased">
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
        aria-label={t('nav.main')}
      >
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-gray-900/90 backdrop-blur-lg border border-gray-800 shadow-2xl shadow-black/30">
          {NAV.map(({ id, labelKey, icon: Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-white/10 text-white font-medium shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t(labelKey)}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
