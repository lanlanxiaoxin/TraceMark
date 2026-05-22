/** 清理 AI 报告正文：去掉寒暄、多余分隔线与空行。 */
export function normalizeAiReportContent(raw: string): string {
  let text = raw.trim()
  if (!text) return text

  // 去掉常见开场白（直到首个标题或正文块）
  text = text.replace(
    /^(?:好的[，,]?|根据您(?:提供)?的[\s\S]*?(?:[。.\n]|---\s*\n))+/u,
    ''
  )
  text = text.replace(/^---+[\s]*\n+/m, '')
  text = text.replace(/\n{4,}/g, '\n\n\n')

  return text.trim()
}
