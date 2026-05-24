/** 从 Markdown 报告中按标题名提取章节正文（不含标题行）。 */
export function extractMarkdownSection(content: string, sectionTitle: string): string {
  const normalized = sectionTitle.trim()
  const matches: { title: string; index: number; level: number }[] = []
  let m: RegExpExecArray | null
  const re = /^#{2,3}\s+(.+?)\s*$/gm
  while ((m = re.exec(content)) !== null) {
    const hashes = m[0].match(/^#+/)?.[0] ?? '##'
    matches.push({ title: m[1]!.trim(), index: m.index, level: hashes.length })
  }

  const hit = matches.find(x => x.title === normalized || x.title.startsWith(normalized))
  if (!hit) return ''

  const start = content.indexOf('\n', hit.index)
  if (start < 0) return ''

  const after = matches.filter(x => x.index > hit.index)
  const next = after.find(x => x.level <= hit.level)
  const end = next ? next.index : content.length

  return content.slice(start, end).trim()
}

/** 解析日报固定章节；解析失败时 output 回退为截断全文。 */
export function parseDailyReportSections(content: string): {
  output: string
  timeAllocation: string
  pending: string
  parsed: boolean
} {
  const output =
    extractMarkdownSection(content, '今日产出') ||
    extractMarkdownSection(content, '按项目归类') ||
    ''
  const timeAllocation =
    extractMarkdownSection(content, '时间分配') || ''
  const pending =
    extractMarkdownSection(content, '待确认项') ||
    extractMarkdownSection(content, '待确认') ||
    '无'

  const parsed = Boolean(output || timeAllocation)
  const fallbackOutput = parsed ? output : content.trim().slice(0, 1200)

  return {
    output: fallbackOutput,
    timeAllocation,
    pending: pending || '无',
    parsed
  }
}
