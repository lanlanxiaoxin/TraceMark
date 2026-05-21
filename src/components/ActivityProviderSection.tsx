import { useCallback, useEffect, useState } from 'react'
import type { ActivityProviderStatus } from '@/env'
import { getActivityProviderStatus, requestActivityPermissions } from '@/lib/activityProvider'

export function ActivityProviderSection(): JSX.Element {
  const [status, setStatus] = useState<ActivityProviderStatus | null>(null)
  const [permMsg, setPermMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await getActivityProviderStatus())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRequestPerm = async (): Promise<void> => {
    setPermMsg(null)
    const result = await requestActivityPermissions()
    setPermMsg(result.message ?? (result.granted ? '权限正常' : '仍需授权'))
    await load()
  }

  if (loading) {
    return <p className="text-sm text-gray-400">检测采集平台…</p>
  }

  if (!status) return <></>

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">前台窗口采集（W8）</h2>
        <p className="text-sm text-gray-500 mt-1">{status.explainPermissions}</p>
      </div>
      <dl className="text-sm space-y-1">
        <div className="flex gap-2">
          <dt className="text-gray-500 w-20 shrink-0">平台</dt>
          <dd className="text-gray-900 font-medium">{status.label}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-500 w-20 shrink-0">状态</dt>
          <dd className={status.available ? 'text-green-700' : 'text-amber-700'}>
            {status.available ? '可采集前台窗口' : '当前无法读取前台窗口'}
          </dd>
        </div>
      </dl>
      {status.platform === 'darwin' && (
        <button
          type="button"
          onClick={() => void onRequestPerm()}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          检测 macOS 权限
        </button>
      )}
      {permMsg && <p className="text-xs text-gray-600">{permMsg}</p>}
    </section>
  )
}
