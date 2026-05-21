import { getDb } from './database'
import type { ActivityCategory } from './window-title-parser'
import { CATEGORY_LABELS } from './window-title-parser'

export interface SanitizationRule {
  pattern: string
  replacement: string
}

export interface SanitizedActivityFields {
  sanitizedTitle: string
  parsedProject: string | null
  parsedFile: string | null
}

function readSetting(key: string, fallback: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

export function getSanitizationRules(): SanitizationRule[] {
  try {
    const raw = JSON.parse(readSetting('sanitization_rules', '[]')) as SanitizationRule[]
    return Array.isArray(raw) ? raw.filter(r => r.pattern) : []
  } catch {
    return []
  }
}

export function getExcludeTitleKeywords(): string[] {
  try {
    const raw = JSON.parse(readSetting('exclude_title_keywords', '[]')) as string[]
    return Array.isArray(raw) ? raw.map(k => k.trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function applySanitizationRules(text: string, rules: SanitizationRule[]): string {
  let result = text
  for (const rule of rules) {
    try {
      const re = new RegExp(rule.pattern, 'g')
      result = result.replace(re, rule.replacement)
    } catch {
      // skip invalid regex
    }
  }
  return result
}

export function sanitizeActivityFields(
  windowTitle: string,
  parsedProject: string | null,
  parsedFile: string | null
): SanitizedActivityFields {
  const rules = getSanitizationRules()
  return {
    sanitizedTitle: applySanitizationRules(windowTitle, rules),
    parsedProject: parsedProject ? applySanitizationRules(parsedProject, rules) : null,
    parsedFile: parsedFile ? applySanitizationRules(parsedFile, rules) : null
  }
}

/** Layer 3: 仅结构化摘要，不含原始窗口标题与可执行路径 */
export interface AiSafeActivitySummary {
  category: ActivityCategory
  categoryLabel: string
  project: string | null
  file: string | null
  durationMinutes: number
  gitCommits?: string[]
}

/** AI 上传时使用隐私别名替代真实项目名 */
export function resolveProjectDisplayName(
  name: string,
  privacyAlias: string | null | undefined
): string {
  const alias = privacyAlias?.trim()
  return alias || name
}

/** 脱敏单行文本：去路径、应用规则 */
export function sanitizeTextForCloud(text: string | null | undefined): string {
  if (!text?.trim()) return ''
  const rules = getSanitizationRules()
  let result = applySanitizationRules(text.trim(), rules)
  result = result.replace(/[A-Za-z]:\\[^\s]+/g, '[path]')
  result = result.replace(/\/(?:Users|home|tmp)[^\s]*/gi, '[path]')
  return result.slice(0, 500)
}

export function buildAiSafeSummary(
  category: ActivityCategory,
  parsedProject: string | null,
  parsedFile: string | null,
  durationMs: number,
  gitCommits?: string[]
): AiSafeActivitySummary {
  return {
    category,
    categoryLabel: CATEGORY_LABELS[category],
    project: parsedProject,
    file: parsedFile,
    durationMinutes: Math.max(1, Math.round(durationMs / 60000)),
    ...(gitCommits?.length ? { gitCommits } : {})
  }
}
