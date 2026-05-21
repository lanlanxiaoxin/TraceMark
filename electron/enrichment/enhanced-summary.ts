import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, extname, basename } from 'path'
import type { ActivityCategory } from '../window-title-parser'
import { sanitizeTextForCloud } from '../sanitizer'
import { isCapabilityEnabled, PRIVACY_CAPABILITIES } from '../privacy-capabilities'
import { listProjectAliases } from '../project-spaces'
import { createSessionSummary, listSessionSummariesInRange, type SessionSourceType } from '../session-summaries'
import type { EvidenceItem } from '../work-assets'

const SNIPPET_MAX_BYTES = 2048
const DIR_SCAN_MAX_FILES = 5
const DIR_SCAN_MAX_DEPTH = 2

const DOC_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.sql',
  '.html',
  '.css',
  '.vue',
  '.xml',
  '.csv'
])

export interface EnhancedCaptureInput {
  activityLogId: number | null
  projectId: number | null
  processName: string
  category: ActivityCategory
  parsedFile: string | null
  sanitizedTitle: string | null
  parsedProject: string | null
}

function isL2Enabled(): boolean {
  return isCapabilityEnabled('global', null, PRIVACY_CAPABILITIES.L2_ENHANCED)
}

function isL3EnabledForProject(projectId: number): boolean {
  return isCapabilityEnabled('project', String(projectId), PRIVACY_CAPABILITIES.L3_PROJECT_DIR)
}

function looksLikeFilePath(value: string): boolean {
  const v = value.trim()
  if (!v || v.length > 512) return false
  if (/^[A-Za-z]:\\/.test(v) || v.startsWith('/') || v.startsWith('\\\\')) return true
  return v.includes('\\') || (v.includes('/') && !v.includes(' '))
}

function looksLikeDirectory(value: string): boolean {
  const v = value.trim()
  if (!looksLikeFilePath(v)) return false
  try {
    return existsSync(v) && statSync(v).isDirectory()
  } catch {
    return false
  }
}

function normalizeExistingPath(filePath: string): string | null {
  try {
    const resolved = resolve(filePath.trim())
    if (!existsSync(resolved)) return null
    const st = statSync(resolved)
    if (!st.isFile()) return null
    return resolved
  } catch {
    return null
  }
}

function isPathUnderRoot(filePath: string, rootDir: string): boolean {
  const root = resolve(rootDir)
  const file = resolve(filePath)
  return file === root || file.startsWith(root + (process.platform === 'win32' ? '\\' : '/'))
}

function readDocumentSnippetFromPath(filePath: string, requireL2: boolean): string | null {
  if (requireL2 && !isL2Enabled()) return null
  const path = normalizeExistingPath(filePath)
  if (!path) return null
  const ext = extname(path).toLowerCase()
  if (!DOC_EXTENSIONS.has(ext)) return null
  try {
    const buf = readFileSync(path)
    const slice = buf.subarray(0, SNIPPET_MAX_BYTES)
    const text = slice.toString('utf8').replace(/\0/g, '')
    const sanitized = sanitizeTextForCloud(text)
    if (!sanitized) return null
    const name = basename(path)
    return `[${name}] ${sanitized.slice(0, 400)}`
  } catch {
    return null
  }
}

/** L2：读取当前活跃文档片段（仅本地文件、限量） */
export function readActiveDocumentSnippet(filePath: string | null): string | null {
  if (!filePath) return null
  return readDocumentSnippetFromPath(filePath, true)
}

function meetingSourceType(processName: string, category: ActivityCategory): SessionSourceType {
  if (category === 'meeting') return 'meeting'
  const p = processName.toLowerCase()
  if (
    p.includes('wechat') ||
    p.includes('dingtalk') ||
    p.includes('slack') ||
    p.includes('discord') ||
    p.includes('telegram') ||
    p.includes('lark')
  ) {
    return 'chat'
  }
  return category === 'communication' ? 'chat' : 'meeting'
}

/** L2：会议/聊天窗口标题摘要 */
export function buildMeetingChatSummary(input: EnhancedCaptureInput): string | null {
  if (!isL2Enabled()) return null
  if (input.category !== 'meeting' && input.category !== 'communication') return null
  const title =
    sanitizeTextForCloud(input.sanitizedTitle) ||
    sanitizeTextForCloud(input.parsedProject) ||
    sanitizeTextForCloud(input.processName)
  if (!title) return null
  const prefix = input.category === 'meeting' ? '会议' : '沟通'
  return `${prefix}：${title}`
}

export function getProjectDocumentDirectories(projectId: number): string[] {
  const aliases = listProjectAliases(projectId)
  return aliases
    .filter(a => a.aliasType === 'document')
    .map(a => a.value.trim())
    .filter(looksLikeDirectory)
}

/** L3：扫描项目绑定目录下的文档片段（不上传全文） */
export function scanProjectDirectorySnippets(projectId: number): string[] {
  if (!isL3EnabledForProject(projectId)) return []
  const dirs = getProjectDocumentDirectories(projectId)
  const snippets: string[] = []

  const walk = (dir: string, depth: number): void => {
    if (snippets.length >= DIR_SCAN_MAX_FILES || depth > DIR_SCAN_MAX_DEPTH) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (snippets.length >= DIR_SCAN_MAX_FILES) break
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(full, depth + 1)
        continue
      }
      if (!DOC_EXTENSIONS.has(extname(name).toLowerCase())) continue
      if (!isPathUnderRoot(full, dir)) continue
      const snippet = readDocumentSnippetFromPath(full, false)
      if (snippet) snippets.push(snippet)
    }
  }

  for (const dir of dirs) {
    walk(resolve(dir), 0)
  }
  return snippets
}

export async function maybeCaptureEnhancedSummary(input: EnhancedCaptureInput): Promise<void> {
  if (!isL2Enabled()) return

  const docSnippet = readActiveDocumentSnippet(input.parsedFile)
  if (docSnippet && input.activityLogId) {
    createSessionSummary({
      projectId: input.projectId,
      activityLogId: input.activityLogId,
      processName: input.processName,
      sourceType: 'document',
      summary: docSnippet,
      sourceLevel: 'enhanced'
    })
  }

  const meetingSummary = buildMeetingChatSummary(input)
  if (meetingSummary && input.activityLogId) {
    const sourceType =
      input.category === 'meeting'
        ? 'meeting'
        : meetingSourceType(input.processName, input.category)
    createSessionSummary({
      projectId: input.projectId,
      activityLogId: input.activityLogId,
      processName: input.processName,
      sourceType,
      summary: meetingSummary,
      sourceLevel: 'enhanced'
    })
  }
}

export function collectEnhancedEvidenceForUnit(
  projectId: number | null,
  logIds: number[],
  startedAt: number,
  endedAt: number
): EvidenceItem[] {
  const evidence: EvidenceItem[] = []
  if (!isL2Enabled()) return evidence

  const summaries = listSessionSummariesInRange(projectId, startedAt, endedAt, 20)
  for (const s of summaries) {
    if (s.activityLogId != null && logIds.length > 0 && !logIds.includes(s.activityLogId)) {
      continue
    }
    evidence.push({
      type: s.sourceType,
      summary: s.summary,
      activityLogId: s.activityLogId ?? undefined,
      metadata: { sourceLevel: s.sourceLevel }
    })
  }

  if (projectId != null) {
    for (const snippet of scanProjectDirectorySnippets(projectId).slice(0, 3)) {
      evidence.push({
        type: 'document',
        summary: `目录文档：${snippet.slice(0, 200)}`,
        metadata: { l3: true }
      })
    }
  }

  return evidence
}
