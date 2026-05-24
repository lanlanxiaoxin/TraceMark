import { test } from 'node:test'
import assert from 'node:assert/strict'

/** Mirrors electron/sanitizer.ts resolveProjectDisplayName */
function resolveProjectDisplayName(name, privacyAlias) {
  const alias = privacyAlias?.trim()
  return alias || name
}

/** Mirrors electron/date-bounds.ts weekBoundsFromStart */
function weekBoundsFromStart(weekStartMs) {
  const start = new Date(weekStartMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(weekStartMs)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

/** Mirrors shared/local-metrics-aggregate.ts startOfLocalDayMs */
function startOfLocalDayMs(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Mirrors shared/local-metrics-aggregate.ts aggregateMetricsByDayFromRows */
function aggregateMetricsByDayFromRows(rows, name, from, to) {
  const counts = new Map()
  for (const row of rows) {
    if (row.name !== name) continue
    if (row.created_at < from || row.created_at > to) continue
    const day = startOfLocalDayMs(row.created_at)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([dateMs, count]) => ({ dateMs, count }))
    .sort((a, b) => a.dateMs - b.dateMs)
}

/** Mirrors shared/local-metrics-aggregate.ts aggregateMetricsByNameFromRows */
function aggregateMetricsByNameFromRows(rows, from, to) {
  const counts = new Map()
  for (const row of rows) {
    if (row.created_at < from || row.created_at > to) continue
    counts.set(row.name, (counts.get(row.name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

test('resolveProjectDisplayName prefers privacy alias', () => {
  assert.equal(resolveProjectDisplayName('Secret', 'Project_A'), 'Project_A')
  assert.equal(resolveProjectDisplayName('Secret', ''), 'Secret')
})

test('week bounds spans 7 days', () => {
  const start = new Date('2026-05-18T00:00:00')
  const { start: s, end: e } = weekBoundsFromStart(start.getTime())
  assert.equal(Math.round((e - s) / 86400000), 7)
})

test('aggregateMetricsByDayFromRows groups by local day', () => {
  const day1 = new Date('2026-05-20T10:00:00').getTime()
  const day1Later = new Date('2026-05-20T18:00:00').getTime()
  const day2 = new Date('2026-05-21T09:00:00').getTime()
  const rows = [
    { name: 'page_visit', created_at: day1 },
    { name: 'page_visit', created_at: day1Later },
    { name: 'page_visit', created_at: day2 },
    { name: 'asset_confirmed', created_at: day1 }
  ]
  const from = new Date('2026-05-20T00:00:00').getTime()
  const to = new Date('2026-05-21T23:59:59').getTime()
  const out = aggregateMetricsByDayFromRows(rows, 'page_visit', from, to)
  assert.equal(out.length, 2)
  assert.equal(out[0].count, 2)
  assert.equal(out[1].count, 1)
  assert.equal(out[0].dateMs, startOfLocalDayMs(day1))
})

/** Mirrors electron/local-metrics.ts exportMetricsAsJson shape */
function exportMetricsJsonFromRows(rows, filter = {}) {
  const limit = filter.limit ?? 10_000
  const sliced = rows.slice(0, limit)
  return JSON.stringify(
    {
      exportedAt: Date.now(),
      count: sliced.length,
      items: sliced.map(r => ({ name: r.name, payload: null, createdAt: r.created_at, id: 1 }))
    },
    null,
    2
  )
}

/** Mirrors electron/daily-report-v3.ts formatSealBlock (simplified) */
function formatSealBlockMirror(seal) {
  if (!seal) return '（当日未完成今日盖章）'
  if (seal.skippedMainline) return '- 主线：已跳过'
  const project = seal.projectName || seal.parsedProjectLabel || '（未识别项目）'
  return `- **主线项目**：${project}`
}

test('formatSealBlockMirror includes mainline project', () => {
  const text = formatSealBlockMirror({
    skippedMainline: false,
    projectName: 'TraceMark',
    parsedProjectLabel: null,
    note: '完成 W3'
  })
  assert.ok(text.includes('TraceMark'))
  assert.ok(formatSealBlockMirror({ skippedMainline: true }).includes('跳过'))
})

test('exportMetricsJsonFromRows returns parseable envelope', () => {
  const t = new Date('2026-05-20T12:00:00').getTime()
  const rows = [{ name: 'today_seal_completed', created_at: t }]
  const json = exportMetricsJsonFromRows(rows)
  const parsed = JSON.parse(json)
  assert.equal(parsed.count, 1)
  assert.equal(parsed.items[0].name, 'today_seal_completed')
  assert.ok(typeof parsed.exportedAt === 'number')
})

/** Mirrors shared/asset-search-query.ts parseAssetSearchQuery */
function parseAssetSearchQueryMirror(raw, now = Date.now()) {
  let text = raw.trim()
  let dateStart
  let dateEnd
  let assetKind
  const kindMatch = text.match(/#(outcome|process|evidence)\b/i)
  if (kindMatch) {
    assetKind = kindMatch[1].toLowerCase()
    text = text.replace(kindMatch[0], '').trim()
  }
  const week = text.match(/@last-week\b/i)
  if (week) {
    dateStart = now - 7 * 86400000
    dateEnd = now
    text = text.replace(week[0], '').trim()
  }
  const d30 = text.match(/@30d\b/i)
  if (d30) {
    dateStart = now - 30 * 86400000
    dateEnd = now
    text = text.replace(d30[0], '').trim()
  }
  return { text, dateStart, dateEnd, assetKind }
}

test('parseAssetSearchQueryMirror strips time and kind tokens', () => {
  const now = new Date('2026-05-24T12:00:00').getTime()
  const parsed = parseAssetSearchQueryMirror('auth bug @last-week #outcome', now)
  assert.equal(parsed.text, 'auth bug')
  assert.equal(parsed.assetKind, 'outcome')
  assert.equal(parsed.dateEnd, now)
  assert.ok(parsed.dateStart < now)
})

/** Mirrors shared/markdown-normalize.ts normalizeMarkdownContent (list-marker fixes) */
function normalizeMarkdownContent(raw) {
  let text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return text
  text = text.replace(/^---+[\s]*\n?/gm, '')
  const lines = text.split('\n')
  const cleaned = []
  for (const line of lines) {
    let ln = line
    ln = ln.replace(/^(\s*)[•·▪]\s+/u, '$1- ')
    ln = ln.replace(/^(\s*)–\s+/u, '$1- ')
    ln = ln.replace(/^(\s*)-\*(?=\s|$)/u, '$1- ')
    ln = ln.replace(/^(\s*)-\s*\*\s+/u, '$1- ')
    ln = ln.replace(/^(\s*)-\s*-\s+/u, '$1- ')
    ln = ln.replace(/^(\s*)\*-\s*/u, '$1- ')
    ln = ln.replace(/^(\s*)\*\s+(?=[^\*])/u, '$1- ')
    if (/^\s*-\s*$/.test(ln)) continue
    if (/^\s*-\s*\*\s*$/.test(ln)) continue
    ln = ln.replace(/^(\s*)-\s{2,}/, '$1- ')
    cleaned.push(ln)
  }
  return cleaned.join('\n').trim()
}

test('normalizeMarkdownContent fixes broken list markers', () => {
  const raw = `## Title\n\n-* first item\n- * second\n---\n-* \n- ok item`
  const out = normalizeMarkdownContent(raw)
  assert.ok(!out.includes('-*'), out)
  assert.match(out, /^- first item/m)
  assert.match(out, /^- second/m)
  assert.match(out, /^- ok item/m)
  assert.ok(!out.includes('---'))
})

test('aggregateMetricsByNameFromRows counts all names in range', () => {
  const t = new Date('2026-05-20T12:00:00').getTime()
  const from = new Date('2026-05-20T00:00:00').getTime()
  const to = new Date('2026-05-20T23:59:59').getTime()
  const rows = [
    { name: 'page_visit', created_at: t },
    { name: 'page_visit', created_at: t + 1000 },
    { name: 'asset_confirmed', created_at: t + 2000 },
    { name: 'page_visit', created_at: t - 86400000 }
  ]
  const out = aggregateMetricsByNameFromRows(rows, from, to)
  assert.equal(out[0].name, 'page_visit')
  assert.equal(out[0].count, 2)
  assert.equal(out[1].name, 'asset_confirmed')
  assert.equal(out[1].count, 1)
})
