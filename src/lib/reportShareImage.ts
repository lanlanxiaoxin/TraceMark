/** 将战报 Markdown 渲染为可分享的 PNG data URL（无额外依赖）。 */
export function renderReportSharePngDataUrl(title: string, markdownBody: string): string {
  const width = 1080
  const padding = 48
  const lineHeight = 28
  const titleHeight = 44
  const maxLines = 42
  const lines = wrapMarkdownLines(markdownBody, 52).slice(0, maxLines)
  if (lines.length === maxLines) {
    lines.push('…（内容已截断，完整版请导出 Markdown）')
  }

  const height = padding * 2 + titleHeight + 24 + lines.length * lineHeight + 40
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = '#f9fafb'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#111827'
  ctx.font = 'bold 32px system-ui, sans-serif'
  ctx.fillText(title, padding, padding + 32)

  ctx.fillStyle = '#374151'
  ctx.font = '20px system-ui, sans-serif'
  let y = padding + titleHeight + 24
  for (const line of lines) {
    ctx.fillText(line, padding, y)
    y += lineHeight
  }

  ctx.fillStyle = '#9ca3af'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText('TraceMark · 个人工作资产账本', padding, height - padding)

  return canvas.toDataURL('image/png')
}

function wrapMarkdownLines(text: string, maxChars: number): string[] {
  const raw = text
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^[-*]\s+/gm, '• ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  const out: string[] = []
  for (const line of raw) {
    if (line.length <= maxChars) {
      out.push(line)
      continue
    }
    let rest = line
    while (rest.length > maxChars) {
      out.push(rest.slice(0, maxChars))
      rest = rest.slice(maxChars)
    }
    if (rest) out.push(rest)
  }
  return out
}
