export function weekBoundsFromStart(weekStartMs: number): { start: number; end: number } {
  const start = new Date(weekStartMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(weekStartMs)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

export function currentWeekStartMs(): number {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
