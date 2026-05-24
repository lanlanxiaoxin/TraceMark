/**
 * 清理 AI 生成的 Markdown：寒暄、分隔线、错误列表符号（如 -*、- *）等。
 */
export function normalizeMarkdownContent(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return text

  text = text.replace(
    /^(?:好的[，,]?|根据您(?:提供)?的[\s\S]*?(?:[。.\n]|---\s*\n))+/u,
    ''
  )
  text = text.replace(
    /^(?:Sure[,.]?|Certainly[,.]?|Here(?:'s| is)[\s\S]*?(?:[.\n]|---\s*\n))+/i,
    ''
  )

  text = text.replace(/^---+[\s]*\n?/gm, '')
  text = text.replace(/\n---+[\s]*\n/g, '\n\n')

  const lines = text.split('\n')
  const cleaned: string[] = []
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
  text = cleaned.join('\n')

  text = text.replace(/\n{4,}/g, '\n\n\n')

  return text.trim()
}

/** @deprecated 使用 normalizeMarkdownContent */
export function normalizeAiReportContent(raw: string): string {
  return normalizeMarkdownContent(raw)
}
