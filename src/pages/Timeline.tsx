import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Monitor, RefreshCw } from 'lucide-react'
import { useActivityLogs } from '@/hooks/useActivityLogs'
import { DayGroup } from '@/components/DayGroup'
import { formatDayLabel, startOfDay } from '@/lib/activityLogs'
import type { TimelineIntent } from '@/env'
import {
  hasTimelineFocus,
  isHighlightResolved,
  resolveHighlightLogId,
  type TimelineFocus
} from '@/lib/timelineJump'

interface TimelineProps {
  intent?: TimelineIntent
  onIntentConsumed?: () => void
}

function intentHasPayload(intent: TimelineIntent | undefined): boolean {
  if (!intent) return false
  return (
    intent.dayTimestamp != null ||
    intent.highlightActivityLogId != null ||
    intent.focusStartedAt != null
  )
}

export function Timeline({ intent, onIntentConsumed }: TimelineProps): JSX.Element {
  const { t } = useTranslation()
  const [dayTimestamp, setDayTimestamp] = useState(() => intent?.dayTimestamp ?? Date.now())
  const [focus, setFocus] = useState<TimelineFocus>({})
  const [focusBanner, setFocusBanner] = useState(false)

  const { logs, total, loading, loadingMore, error, hasMore, loadMore, refresh } =
    useActivityLogs({ dayTimestamp })
  const sentinelRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  useEffect(() => {
    if (!intentHasPayload(intent)) return

    if (intent!.dayTimestamp != null) setDayTimestamp(intent!.dayTimestamp)
    setFocus({
      highlightActivityLogId: intent!.highlightActivityLogId,
      focusStartedAt: intent!.focusStartedAt
    })
    setFocusBanner(hasTimelineFocus(intent!))
    scrolledRef.current = false
    onIntentConsumed?.()
  }, [intent, onIntentConsumed])

  const highlightLogId = useMemo(() => resolveHighlightLogId(logs, focus), [logs, focus])

  const highlightReady = useMemo(
    () => isHighlightResolved(logs, focus, hasMore),
    [logs, focus, hasMore]
  )

  const highlightVisible = highlightReady && highlightLogId != null

  useEffect(() => {
    if (!hasTimelineFocus(focus) || loading || loadingMore) return
    if (highlightReady || !hasMore) return
    loadMore()
  }, [focus, highlightReady, hasMore, loading, loadingMore, loadMore])

  useEffect(() => {
    if (!highlightVisible || scrolledRef.current) return
    const timerId = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      scrolledRef.current = true
    }, 120)
    return () => window.clearTimeout(timerId)
  }, [highlightVisible, highlightLogId, logs.length])

  const handleItemDeleted = (): void => {
    refresh()
  }

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '120px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const isToday = useMemo(
    () => startOfDay(dayTimestamp) === startOfDay(Date.now()),
    [dayTimestamp]
  )

  const shiftDay = (delta: number): void => {
    setFocus({})
    setFocusBanner(false)
    scrolledRef.current = false
    setDayTimestamp(ts => startOfDay(ts) + delta * 24 * 60 * 60 * 1000)
  }

  const dateInputValue = useMemo(() => {
    const d = new Date(dayTimestamp)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [dayTimestamp])

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-200/60 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">{t('timeline.title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label={t('timeline.prevDay')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={dateInputValue}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => {
              const picked = new Date(e.target.value)
              if (!Number.isNaN(picked.getTime())) {
                setFocus({})
                setFocusBanner(false)
                scrolledRef.current = false
                setDayTimestamp(picked.getTime())
              }
            }}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          />
          <button
            type="button"
            onClick={() => shiftDay(1)}
            disabled={isToday}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            aria-label={t('timeline.nextDay')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => {
                setFocus({})
                setFocusBanner(false)
                scrolledRef.current = false
                setDayTimestamp(Date.now())
              }}
              className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              {t('timeline.backToToday')}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {t('timeline.daySummary', {
            label: formatDayLabel(dayTimestamp),
            total
          })}
          {focusBanner && highlightVisible ? t('timeline.highlightActive') : ''}
        </p>
        {focusBanner && hasTimelineFocus(focus) && !highlightVisible && !hasMore && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {t('timeline.notFoundBanner')}
          </p>
        )}
      </header>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {!error && logs.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Monitor className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">{t('timeline.emptyTitle')}</p>
          <p className="text-xs text-gray-400">{t('timeline.emptyBody')}</p>
        </div>
      )}

      {!error && logs.length > 0 && (
        <>
          <DayGroup
            dayTimestamp={dayTimestamp}
            logs={logs}
            onItemDeleted={handleItemDeleted}
            highlightLogId={highlightVisible ? highlightLogId : null}
            highlightRef={highlightRef}
          />
          <div ref={sentinelRef} className="h-8 flex items-center justify-center">
            {loadingMore && (
              <RefreshCw
                className="w-5 h-5 text-gray-400 animate-spin"
                aria-label={t('timeline.loadMoreAria')}
              />
            )}
            {!hasMore && <p className="text-xs text-gray-400">{t('timeline.allLoaded')}</p>}
          </div>
        </>
      )}
    </div>
  )
}
