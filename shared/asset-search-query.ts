/** 命令面板 / 资产回忆检索的查询解析（主进程与渲染进程共用）。 */

export type AssetSearchKindToken = 'outcome' | 'process' | 'evidence'

export interface ParsedAssetSearchQuery {
  /** 去掉 @ / # 修饰符后的全文检索词 */
  text: string
  dateStart?: number
  dateEnd?: number
  assetKind?: AssetSearchKindToken
}

const MS_DAY = 24 * 60 * 60 * 1000

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function endOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function parseDateToken(token: string, now: number): { start: number; end: number } | null {
  const iso = token.match(/^@(\d{4})-(\d{2})-(\d{2})$/i)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2]) - 1
    const day = Number(iso[3])
    const start = new Date(y, m, day).getTime()
    if (Number.isNaN(start)) return null
    return { start: startOfDay(start), end: endOfDay(start) }
  }

  const md = token.match(/^@(\d{2})-(\d{2})$/i)
  if (md) {
    const y = new Date(now).getFullYear()
    const start = new Date(y, Number(md[1]) - 1, Number(md[2])).getTime()
    if (Number.isNaN(start)) return null
    return { start: startOfDay(start), end: endOfDay(start) }
  }

  return null
}

function parseRelativeDays(token: string, now: number): { start: number; end: number } | null {
  const lower = token.toLowerCase()
  if (lower === '@last-week' || lower === '@week') {
    return { start: now - 7 * MS_DAY, end: now }
  }
  const dMatch = lower.match(/^@(?:last-)?(\d+)d$/)
  if (dMatch) {
    const days = Number(dMatch[1])
    if (days > 0 && days <= 366) return { start: now - days * MS_DAY, end: now }
  }
  return null
}

/**
 * 支持修饰符：
 * - `@last-week` `@7d` `@30d` `@2026-05-24` `@05-24`
 * - `#outcome` `#process` `#evidence`
 */
export function parseAssetSearchQuery(raw: string, now = Date.now()): ParsedAssetSearchQuery {
  let text = raw.trim()
  let dateStart: number | undefined
  let dateEnd: number | undefined
  let assetKind: AssetSearchKindToken | undefined

  const kindMatch = text.match(/#(outcome|process|evidence)\b/i)
  if (kindMatch) {
    assetKind = kindMatch[1].toLowerCase() as AssetSearchKindToken
    text = text.replace(kindMatch[0], '').trim()
  }

  for (const token of [...text.matchAll(/@\S+/g)].map(m => m[0])) {
    const relative = parseRelativeDays(token, now)
    if (relative) {
      dateStart = relative.start
      dateEnd = relative.end
      text = text.replace(token, '').trim()
      continue
    }
    const absolute = parseDateToken(token, now)
    if (absolute) {
      dateStart = absolute.start
      dateEnd = absolute.end
      text = text.replace(token, '').trim()
    }
  }

  return { text, dateStart, dateEnd, assetKind }
}

export const ASSET_SEARCH_HINT =
  '支持 @last-week @30d @2026-05-24 · #outcome · 同时搜资产与原始活动'
