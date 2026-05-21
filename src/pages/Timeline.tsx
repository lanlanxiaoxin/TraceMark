import { useEffect, useRef } from 'react'
import { Monitor, RefreshCw } from 'lucide-react'
import { useActivityLogs } from '@/hooks/useActivityLogs'
import { DayGroup } from '@/components/DayGroup'

export function Timeline(): JSX.Element {
  const { logs, total, loading, loadingMore, error, hasMore, loadMore, refresh } = useActivityLogs()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef(Date.now())

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
      <header>
        <h1 className="text-2xl font-bold text-gray-900">时间轴</h1>
        <p className="text-sm text-gray-500 mt-1">今日共 {total} 段前台应用活动</p>
      </header>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {!error && logs.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Monitor className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">今日暂无进程活动记录</p>
          <p className="text-xs text-gray-400">
            应用会在后台自动记录您当前使用的前台窗口，切换应用后时间轴会更新
          </p>
        </div>
      )}

      {!error && logs.length > 0 && (
        <>
          <DayGroup dayTimestamp={todayRef.current} logs={logs} onItemDeleted={handleItemDeleted} />
          <div ref={sentinelRef} className="h-8 flex items-center justify-center">
            {loadingMore && (
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" aria-label="加载更多" />
            )}
            {!hasMore && <p className="text-xs text-gray-400">已加载全部记录</p>}
          </div>
        </>
      )}
    </div>
  )
}
