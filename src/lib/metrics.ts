/** 本地 SQLite 埋点（不上传）。 */
export async function recordMetric(
  name: string,
  payload?: Record<string, unknown>
): Promise<boolean> {
  return window.electronAPI.recordMetric(name, payload)
}

export async function countMetrics(name?: string): Promise<number> {
  return window.electronAPI.countMetrics(name)
}
