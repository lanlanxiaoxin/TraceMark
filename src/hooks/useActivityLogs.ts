import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  listActivityLogs,
  subscribeActivityLogsUpdated,
  startOfDay,
  endOfDay,
  type ActivityLog
} from '@/lib/activityLogs'

const PAGE_SIZE = 50

interface UseActivityLogsOptions {
  dayTimestamp?: number
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  // 稳定 dayTs，避免每次渲染因 Date.now() 变化导致 effect 循环
  const dayTs = useMemo(() => options.dayTimestamp ?? Date.now(), [options.dayTimestamp])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const initialLoadDone = useRef(false)
  const fetchIdRef = useRef(0)

  const fetchLogs = useCallback(
    async (append = false) => {
      const fetchId = ++fetchIdRef.current
      const offset = append ? offsetRef.current : 0
      if (append) setLoadingMore(true)
      else if (!initialLoadDone.current) setLoading(true)
      setError(null)

      try {
        const result = await listActivityLogs({
          startTime: startOfDay(dayTs),
          endTime: endOfDay(dayTs),
          limit: PAGE_SIZE,
          offset
        })

        // 丢弃过期请求（较新的 fetchLogs 已发起）
        if (fetchId !== fetchIdRef.current) return

        setTotal(result.total)
        offsetRef.current = offset + result.items.length
        setLogs(prev => (append ? [...prev, ...result.items] : result.items))
        initialLoadDone.current = true
      } catch {
        if (fetchId !== fetchIdRef.current) return
        setError('加载记录失败，请稍后重试')
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [dayTs]
  )

  useEffect(() => {
    offsetRef.current = 0
    initialLoadDone.current = false
    fetchLogs(false)
  }, [fetchLogs])

  useEffect(() => {
    const unsubscribe = subscribeActivityLogsUpdated(() => {
      offsetRef.current = 0
      initialLoadDone.current = false
      fetchLogs(false)
    })
    return unsubscribe
  }, [fetchLogs])

  const loadMore = useCallback(() => {
    if (loadingMore || logs.length >= total) return
    fetchLogs(true)
  }, [fetchLogs, loadingMore, logs.length, total])

  const hasMore = logs.length < total

  return { logs, total, loading, loadingMore, error, hasMore, loadMore, refresh: () => fetchLogs(false) }
}
