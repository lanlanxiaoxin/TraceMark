import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Monitor, Search } from 'lucide-react'
import type { AppPage } from '@/components/AppShell'
import type { ProjectsIntent } from '@/pages/Projects'
import type { ActivityRecallHit, TimelineIntent, WorkAsset } from '@/env'
import { listProjectSpaces } from '@/lib/projectSpaces'
import type { ProjectSpace } from '@/env'
import { searchWorkAssetsRecall } from '@/lib/assetSearch'
import { startOfDay } from '@/lib/activityLogs'
import { formatShortDayLabel } from '@/lib/i18nFormat'
import { getDateLocaleTag } from '@/i18n'
import { recordMetric } from '@/lib/metrics'
import { timelineIntentFromActivity, timelineIntentFromAsset } from '@/lib/timelineJump'

interface Candidate {
  id: string
  group: 'nav' | 'project' | 'asset' | 'activity'
  primary: string
  secondary?: string
  run: () => void
}

interface CommandPaletteProps {
  onNavigate: (page: AppPage, intent?: ProjectsIntent) => void
  onOpenTimeline: (intent: TimelineIntent) => void
}

function activityTitle(hit: ActivityRecallHit, fallback: string): string {
  return (
    hit.sanitizedTitle ||
    hit.parsedFile?.split(/[/\\]/).pop() ||
    hit.parsedProject ||
    hit.processName ||
    fallback
  )
}

export function CommandPalette({
  onNavigate,
  onOpenTimeline
}: CommandPaletteProps): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const navItems = useMemo(
    () => [
      { id: 'n-today', page: 'today' as const, primary: t('nav.today'), secondary: t('commandPalette.todaySecondary') },
      {
        id: 'n-projects',
        page: 'projects' as const,
        primary: t('nav.projects'),
        secondary: t('commandPalette.projectsSecondary')
      },
      {
        id: 'n-timeline',
        page: 'timeline' as const,
        primary: t('nav.timeline'),
        secondary: t('commandPalette.timelineSecondary')
      },
      {
        id: 'n-reports',
        page: 'reports' as const,
        primary: t('nav.reports'),
        secondary: t('commandPalette.reportsSecondary')
      },
      {
        id: 'n-settings',
        page: 'settings' as const,
        primary: t('nav.settings'),
        secondary: t('commandPalette.settingsSecondary')
      }
    ],
    [t]
  )

  const formatAssetWhen = useCallback(
    (asset: WorkAsset): string => {
      const ts = asset.startedAt ?? asset.createdAt
      const label = formatShortDayLabel(ts)
      const kind =
        asset.assetKind === 'outcome'
          ? t('commandPalette.assetKindOutcome')
          : asset.assetKind === 'process'
            ? t('commandPalette.assetKindProcess')
            : t('commandPalette.assetKindEvidence')
      const status =
        asset.status === 'confirmed' ? t('commandPalette.statusConfirmed') : asset.status
      return `${label} · ${kind} · ${status}`
    },
    [t]
  )

  const formatActivityWhen = useCallback(
    (hit: ActivityRecallHit): string => {
      const label = formatShortDayLabel(hit.startedAt)
      const time = new Date(hit.startedAt).toLocaleTimeString(getDateLocaleTag(), {
        hour: '2-digit',
        minute: '2-digit'
      })
      return `${label} ${time} · ${t('commandPalette.rawActivity')}`
    },
    [t]
  )
  const [q, setQ] = useState('')
  const [projects, setProjects] = useState<ProjectSpace[]>([])
  const [assets, setAssets] = useState<WorkAsset[]>([])
  const [activities, setActivities] = useState<ActivityRecallHit[]>([])
  const [searching, setSearching] = useState(false)
  const [aiRerank, setAiRerank] = useState(false)
  const [active, setActive] = useState(0)
  const lastSearchQuery = useRef('')
  const searchRequestId = useRef(0)

  const close = useCallback((): void => {
    setOpen(false)
    setQ('')
    setAssets([])
    setActivities([])
    setActive(0)
    setAiRerank(false)
    lastSearchQuery.current = ''
    searchRequestId.current += 1
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    setAssets([])
    setActivities([])
    void listProjectSpaces().then(setProjects)
  }, [open])

  const runRecallSearch = useCallback(
    async (query: string, rerank: boolean): Promise<void> => {
      const s = query.trim()
      if (s.length < 1) {
        setAssets([])
        setActivities([])
        setSearching(false)
        return
      }

      const requestId = ++searchRequestId.current
      setSearching(true)
      if (s !== lastSearchQuery.current) {
        lastSearchQuery.current = s
        void recordMetric('asset_search_triggered', { query: s })
      }
      try {
        const result = await searchWorkAssetsRecall(s, {
          limit: 12,
          rerank,
          activityLimit: 8
        })
        if (requestId !== searchRequestId.current) return
        setAssets(result.items)
        setActivities(result.activities)
        const hitCount = result.items.length + result.activities.length
        if (hitCount > 0) {
          void recordMetric('asset_search_hit', { query: s, hitCount })
        }
      } finally {
        if (requestId === searchRequestId.current) {
          setSearching(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!open) return
    const s = q.trim()
    if (s.length < 1) {
      setAssets([])
      setActivities([])
      setSearching(false)
      return
    }

    const timer = window.setTimeout(() => {
      void runRecallSearch(s, false)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [q, open, runRecallSearch])

  const recallMode = q.trim().length > 0

  const candidates = useMemo((): Candidate[] => {
    const ql = q.trim().toLowerCase()
    const match = (s: string): boolean => !ql || s.toLowerCase().includes(ql)
    const nav: Candidate[] = []
    const projectCandidates: Candidate[] = []
    const assetCandidates: Candidate[] = []
    const activityCandidates: Candidate[] = []

    if (!recallMode) {
      for (const n of navItems) {
        if (match(n.primary) || match(n.secondary)) {
          nav.push({
            id: n.id,
            group: 'nav',
            primary: n.primary,
            secondary: n.secondary,
            run: () => {
              onNavigate(n.page)
              close()
            }
          })
        }
      }
    }

    for (const p of projects) {
      if (recallMode && !match(p.name)) continue
      if (!recallMode && !match(p.name)) continue
      projectCandidates.push({
        id: `p-${p.id}`,
        group: 'project',
        primary: t('commandPalette.projectPrefix', { name: p.name }),
        secondary: t('commandPalette.projectOpen'),
        run: () => {
          onNavigate('projects', { tab: 'spaces', projectId: p.id })
          close()
        }
      })
    }

    for (const a of assets) {
      assetCandidates.push({
        id: `a-${a.id}`,
        group: 'asset',
        primary: a.title,
        secondary: formatAssetWhen(a),
        run: () => {
          void recordMetric('asset_search_clicked', { query: q.trim(), assetId: a.id })
          onOpenTimeline(timelineIntentFromAsset(a))
          close()
        }
      })
    }

    for (const act of activities) {
      activityCandidates.push({
        id: `act-${act.id}`,
        group: 'activity',
        primary: activityTitle(act, t('commandPalette.foregroundActivity')),
        secondary: formatActivityWhen(act),
        run: () => {
          onOpenTimeline(timelineIntentFromActivity(act))
          close()
        }
      })
    }

    if (recallMode) {
      return [...assetCandidates, ...activityCandidates, ...projectCandidates, ...nav]
    }
    return [...nav, ...projectCandidates, ...assetCandidates]
  }, [
    q,
    projects,
    assets,
    activities,
    recallMode,
    onNavigate,
    onOpenTimeline,
    close,
    navItems,
    t,
    formatAssetWhen,
    formatActivityWhen
  ])

  useEffect(() => {
    setActive(0)
  }, [q, candidates.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive(i => Math.min(i + 1, Math.max(0, candidates.length - 1)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && candidates[active]) {
        e.preventDefault()
        candidates[active].run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, candidates, active, close])

  if (!open) return <></>

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t('commandPalette.aria')}
      onClick={e => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          <input
            data-command-palette-input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('commandPalette.searchPlaceholder')}
            className="flex-1 min-w-0 py-2 text-sm outline-none bg-transparent"
          />
          <label
            className={`hidden sm:flex items-center gap-1.5 shrink-0 text-[11px] rounded-lg border px-2 py-1 cursor-pointer select-none ${
              aiRerank
                ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
            title={t('commandPalette.aiRerankHint')}
          >
            <input
              type="checkbox"
              checked={aiRerank}
              onChange={e => {
                const next = e.target.checked
                setAiRerank(next)
                const s = q.trim()
                if (next && s.length > 0) {
                  void runRecallSearch(s, true)
                } else if (!next && s.length > 0) {
                  void runRecallSearch(s, false)
                }
              }}
              className="w-3 h-3 rounded border-gray-300"
            />
            {t('commandPalette.aiRerank')}
          </label>
          <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[min(60vh,420px)] overflow-y-auto py-1">
          {searching && recallMode ? (
            <li className="px-4 py-6 text-center text-sm text-gray-500">
              {t('commandPalette.searching')}
            </li>
          ) : candidates.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500 space-y-2">
              <p>{t('commandPalette.noResults')}</p>
              {recallMode ? (
                <p className="text-xs text-gray-400">{t('commandPalette.searchHint')}</p>
              ) : null}
            </li>
          ) : (
            candidates.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => c.run()}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-start gap-2 ${
                    i === active ? 'bg-indigo-50 text-indigo-950' : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  {c.group === 'asset' ? (
                    <Clock className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" aria-hidden />
                  ) : null}
                  {c.group === 'activity' ? (
                    <Monitor className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" aria-hidden />
                  ) : null}
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium truncate">{c.primary}</span>
                    {c.secondary ? (
                      <span className="text-xs text-gray-500">{c.secondary}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="text-[10px] text-gray-400 px-4 py-2 border-t border-gray-100 bg-gray-50/80">
          {t('commandPalette.footer', { hint: t('commandPalette.searchHint') })}
        </p>
      </div>
    </div>
  )
}
