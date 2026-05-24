import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { aggregateMetricsByDay, listMetrics } from '@/lib/metrics'
import type { AppPageMetric, DailyMetricAggregate } from '@/lib/metrics'

function dayKey(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatShortDay(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

function buildLast7DayKeys(): number[] {
  const keys: number[] = []
  const today = dayKey(Date.now())
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    keys.push(d.getTime())
  }
  return keys
}

function fillSeries(keys: number[], rows: DailyMetricAggregate[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const k of keys) map.set(k, 0)
  for (const r of rows) {
    if (map.has(r.dateMs)) map.set(r.dateMs, r.count)
  }
  return map
}

function maxCount(...maps: Map<number, number>[]): number {
  let m = 1
  for (const map of maps) {
    for (const v of map.values()) m = Math.max(m, v)
  }
  return m
}

interface MetricBarChartProps {
  label: string
  keys: number[]
  counts: Map<number, number>
  max: number
}

function MetricBarChart({ label, keys, counts, max }: MetricBarChartProps): JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <ul className="space-y-1.5" aria-label={label}>
        {keys.map(k => {
          const count = counts.get(k) ?? 0
          const pct = max > 0 ? Math.round((count / max) * 100) : 0
          return (
            <li key={k} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-gray-500">{formatShortDay(k)}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-800 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right tabular-nums text-gray-700">{count}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}


export function MetricsDashboardSection(): JSX.Element {
  const { t } = useTranslation()
  const pageVisitLabel = useCallback(
    (page: string): string => {
      if (page === 'today') return t('nav.today')
      if (page === 'projects') return t('nav.projects')
      if (page === 'timeline') return t('nav.timeline')
      if (page === 'reports') return t('nav.reports')
      if (page === 'settings') return t('nav.settings')
      return t('common.unknown')
    },
    [t]
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageVisits, setPageVisits] = useState<Map<number, number>>(new Map())
  const [assetConfirmed, setAssetConfirmed] = useState<Map<number, number>>(new Map())
  const [sealCompleted, setSealCompleted] = useState<Map<number, number>>(new Map())
  const [pageBreakdown, setPageBreakdown] = useState<Map<string, number>>(new Map())
  const dayKeys = useMemo(() => buildLast7DayKeys(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const from = dayKeys[0]
    const end = new Date(dayKeys[dayKeys.length - 1])
    end.setHours(23, 59, 59, 999)
    const to = end.getTime()
    try {
      const [visits, confirmed, sealed, visitRows] = await Promise.all([
        aggregateMetricsByDay('page_visit', from, to),
        aggregateMetricsByDay('asset_confirmed', from, to),
        aggregateMetricsByDay('today_seal_completed', from, to),
        listMetrics({ name: 'page_visit', from, to, limit: 5000 })
      ])
      setPageVisits(fillSeries(dayKeys, visits))
      setAssetConfirmed(fillSeries(dayKeys, confirmed))
      setSealCompleted(fillSeries(dayKeys, sealed))
      const byPage = new Map<string, number>()
      for (const row of visitRows) {
        const page = (row.payload?.page as AppPageMetric | undefined) ?? 'unknown'
        byPage.set(page, (byPage.get(page) ?? 0) + 1)
      }
      setPageBreakdown(byPage)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.errLoadMetrics'))
    } finally {
      setLoading(false)
    }
  }, [dayKeys, t])

  useEffect(() => {
    void load()
  }, [load])

  const barMax = maxCount(pageVisits, assetConfirmed, sealCompleted)

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('metrics.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('metrics.subtitle')}</p>
      </div>

      {loading && <p className="text-sm text-gray-400">{t('common.loading')}</p>}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <MetricBarChart
            label={t('metrics.pageVisits')}
            keys={dayKeys}
            counts={pageVisits}
            max={barMax}
          />
          <MetricBarChart
            label={t('metrics.assetConfirmed')}
            keys={dayKeys}
            counts={assetConfirmed}
            max={barMax}
          />
          <MetricBarChart
            label={t('metrics.sealCompleted')}
            keys={dayKeys}
            counts={sealCompleted}
            max={barMax}
          />
          {pageBreakdown.size > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-800">{t('metrics.pageBreakdown')}</p>
              <ul className="space-y-1 text-xs text-gray-600">
                {[...pageBreakdown.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([page, count]) => (
                    <li key={page} className="flex justify-between gap-2">
                      <span>{pageVisitLabel(page)}</span>
                      <span className="tabular-nums text-gray-800">{count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
