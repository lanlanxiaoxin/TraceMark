import { loadPromptFile } from './prompt-path'
import { getDb } from './database'
import { listActivityLogs, type ActivityLogRow } from './activity-logs'
import { buildAiSafeSummary, type AiSafeActivitySummary } from './sanitizer'
import { CATEGORY_LABELS, type ActivityCategory } from './window-title-parser'
import { collectGitCommitsForProjects, loadAllGitDiffSnapshots, cleanupExpiredDiffSnapshots } from './enrichment/git-enrichment'
import { canUseCloudAi } from './privacy-capabilities'
import { normalizeAiReportContent } from './report-content'

interface ResolvedAiConfig {
  baseUrl: string
  model: string
  apiKey: string
}

function readSetting(key: string, fallback: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

function resolveAiConfig(): ResolvedAiConfig | null {
  const apiKey = readSetting('api_key', '').trim()
  if (!apiKey) return null

  if (readSetting('ai_provider_type', 'preset') === 'custom') {
    let baseUrl = readSetting('ai_custom_base_url', '').trim().replace(/\/+$/, '')
    const model = readSetting('ai_custom_model', '').trim()
    if (!baseUrl || !model) return null
    if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`
    return { baseUrl, model, apiKey }
  }

  const presetId = readSetting('ai_preset', readSetting('ai_model', 'deepseek-v4-flash'))
  const presets: Record<string, { baseUrl: string; model: string }> = {
    'deepseek-v4-flash': { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
    'deepseek-v4-pro': { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
    'qwen3.6-flash': {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.6-flash'
    },
    'qwen3.6-plus': {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.6-plus'
    },
    'qwen3.6-max-preview': {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.6-max-preview'
    },
    'kimi-k2.6': {
      baseUrl: 'https://api.moonshot.cn',
      model: 'kimi-k2.6'
    },
    'glm-5.1': {
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-5.1'
    },
    'glm-4.7-flash': {
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4.7-flash'
    },
    'hunyuan-turbos-latest': {
      baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
      model: 'hunyuan-turbos-latest'
    },
    'hunyuan-lite': {
      baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
      model: 'hunyuan-lite'
    },
    'openai-gpt-4o': {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o'
    }
  }
  const preset = presets[presetId] ?? presets['deepseek-v4-flash']
  return { ...preset, apiKey }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatDurationMinutes(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`
}

// ── 工作单元（WorkUnit）模型 ──

interface WorkUnitSegment {
  category: ActivityCategory
  project: string | null
  file: string | null
  startedAt: number
  endedAt: number
  durationMs: number
}

interface WorkUnit {
  project: string | null
  startedAt: number
  endedAt: number
  durationMs: number
  segments: WorkUnitSegment[]
  // 关联证据
  filesChanged: string[]
  insertions: number
  deletions: number
  gitCommits: string[]
  interruptions: number
}

export function buildLocalActivitySummary(
  category: ActivityCategory,
  project: string | null,
  file: string | null,
  durationMs: number,
  gitCommits?: string[]
): string {
  const label = CATEGORY_LABELS[category]
  const duration = formatDurationMinutes(durationMs)

  if (category === 'code_editor') {
    const target = file ?? project ?? '代码'
    const git = gitCommits?.[0] ? `，${gitCommits[0]}` : ''
    return `${target} 开发（${duration}）${git}`.slice(0, 60)
  }
  if (category === 'browser') {
    const hint = file ?? project ?? '资料'
    return `浏览器调研：${hint}（${duration}）`.slice(0, 60)
  }
  if (category === 'docs' || category === 'design') {
    const name = file ?? project ?? label
    return `${label}：${name}（${duration}）`.slice(0, 60)
  }
  if (project) {
    return `${label}：${project}（${duration}）`.slice(0, 60)
  }
  return `${label}活动（${duration}）`
}

interface AggregatedActivity {
  category: ActivityCategory
  project: string | null
  file: string | null
  startedAt: number
  endedAt: number
  gitCommits: string[]
}

function aggregateActivities(logs: ActivityLogRow[]): AggregatedActivity[] {
  const sorted = [...logs].sort((a, b) => a.started_at - b.started_at)
  const result: AggregatedActivity[] = []

  for (const log of sorted) {
    const category = (log.category ?? 'other') as ActivityCategory
    const project = log.parsed_project
    const file = log.parsed_file
    const last = result[result.length - 1]

    if (
      last &&
      last.category === category &&
      last.project === project &&
      last.file === file &&
      log.started_at - last.endedAt < 5 * 60 * 1000
    ) {
      last.endedAt = log.ended_at
      continue
    }

    result.push({
      category,
      project,
      file,
      startedAt: log.started_at,
      endedAt: log.ended_at,
      gitCommits: []
    })
  }

  return result
}

// ── 工作单元合并（PRO4.0 核心聚合） ──

async function buildWorkUnits(logs: ActivityLogRow[], sinceMs: number): Promise<WorkUnit[]> {
  if (logs.length === 0) return []

  const aggregated = aggregateActivities(logs)
  if (aggregated.length === 0) return []

  // 按 project 分组
  const byProject = new Map<string | null, AggregatedActivity[]>()
  for (const a of aggregated) {
    const key = a.project ?? '__other__'
    if (!byProject.has(key)) byProject.set(key, [])
    byProject.get(key)!.push(a)
  }

  const units: WorkUnit[] = []

  for (const [projectKey, activities] of byProject) {
    const project = projectKey === '__other__' ? null : projectKey
    activities.sort((a, b) => a.startedAt - b.startedAt)

    let current: WorkUnit | null = null

    function startNewUnit(seg: AggregatedActivity): WorkUnit {
      return {
        project,
        startedAt: seg.startedAt,
        endedAt: seg.endedAt,
        durationMs: seg.endedAt - seg.startedAt,
        segments: [{
          category: seg.category,
          project: seg.project,
          file: seg.file,
          startedAt: seg.startedAt,
          endedAt: seg.endedAt,
          durationMs: seg.endedAt - seg.startedAt
        }],
        filesChanged: [],
        insertions: 0,
        deletions: 0,
        gitCommits: [],
        interruptions: 0
      }
    }

    for (const act of activities) {
      if (!current) {
        current = startNewUnit(act)
        continue
      }

      const gap = act.startedAt - current.endedAt
      const isShortComm = act.category === 'communication' &&
        (act.endedAt - act.startedAt) < 3 * 60 * 1000

      // 同类别相邻 <5min → 合并
      if (gap >= 0 && gap < 5 * 60 * 1000 &&
        act.category === current.segments[current.segments.length - 1].category) {
        current.segments.push({
          category: act.category,
          project: act.project,
          file: act.file,
          startedAt: act.startedAt,
          endedAt: act.endedAt,
          durationMs: act.endedAt - act.startedAt
        })
        current.endedAt = Math.max(current.endedAt, act.endedAt)
        current.durationMs += act.endedAt - act.startedAt
        continue
      }

      // 同项目 browser/terminal 在编码附近 <15min → 合并（跨类别）
      if (gap >= 0 && gap < 15 * 60 * 1000 &&
        (act.category === 'browser' || act.category === 'terminal') &&
        current.segments.some(s => s.category === 'code_editor')) {
        current.segments.push({
          category: act.category,
          project: act.project,
          file: act.file,
          startedAt: act.startedAt,
          endedAt: act.endedAt,
          durationMs: act.endedAt - act.startedAt
        })
        current.endedAt = Math.max(current.endedAt, act.endedAt)
        current.durationMs += act.endedAt - act.startedAt
        continue
      }

      // 短沟通 → 标记为中断
      if (gap >= 0 && isShortComm) {
        current.segments.push({
          category: act.category,
          project: act.project,
          file: act.file,
          startedAt: act.startedAt,
          endedAt: act.endedAt,
          durationMs: act.endedAt - act.startedAt
        })
        current.endedAt = Math.max(current.endedAt, act.endedAt)
        current.durationMs += act.endedAt - act.startedAt
        current.interruptions++
        continue
      }

      // 其他情况 → 新工作单元
      units.push(current)
      current = startNewUnit(act)
    }

    if (current) units.push(current)
  }

  // 关联 git 证据
  const projectNames = [...new Set(units.map(u => u.project).filter(Boolean))] as string[]
  const gitDiffs = loadAllGitDiffSnapshots(sinceMs)
  const gitCommitsMap = await collectGitCommitsForProjects(projectNames, sinceMs)

  for (const unit of units) {
    if (!unit.project) continue
    const diffs = gitDiffs.get(unit.project) ?? []
    if (diffs.length > 0) {
      const latest = diffs[diffs.length - 1]
      unit.filesChanged = [...new Set(diffs.flatMap(d => d.files))]
      unit.insertions = diffs.reduce((s, d) => s + d.insertions, 0)
      unit.deletions = diffs.reduce((s, d) => s + d.deletions, 0)
    }
    const commits = gitCommitsMap.get(unit.project) ?? []
    unit.gitCommits = commits.map(c => c.message)
  }

  units.sort((a, b) => a.startedAt - b.startedAt)

  // 清理过期 diff 快照
  cleanupExpiredDiffSnapshots()

  return units
}

function formatWorkUnitForPrompt(unit: WorkUnit, index: number): string {
  const label = CATEGORY_LABELS[unit.segments[0]?.category] ?? '其他'
  const timeRange = `${formatTime(unit.startedAt)}–${formatTime(unit.endedAt)}`
  const duration = formatDurationMinutes(unit.durationMs)
  const lines: string[] = [
    `## 工作单元 ${index}：${unit.project ?? '其他活动'}`,
    `- 时间段: ${timeRange}（${duration}）`,
    `- 主要活动: ${label}`
  ]

  const files = [...new Set(unit.segments.map(s => s.file).filter(Boolean))] as string[]
  if (files.length > 0) {
    lines.push(`- 编辑文件: ${files.join(', ')}`)
  }

  if (unit.filesChanged.length > 0) {
    lines.push(`- 变更统计: ${unit.filesChanged.length} 文件, +${unit.insertions}/-${unit.deletions} 行`)
  }
  if (unit.gitCommits.length > 0) {
    lines.push(`- Git 提交: ${unit.gitCommits.join('; ')}`)
  }

  const browserPages = [...new Set(
    unit.segments.filter(s => s.category === 'browser' && s.file).map(s => s.file)
  )] as string[]
  if (browserPages.length > 0) {
    lines.push(`- 浏览器调研: ${browserPages.join(', ')}`)
  }

  if (unit.interruptions > 0) {
    lines.push(`- 中断: ${unit.interruptions} 次`)
  }

  return lines.join('\n')
}

function buildCategoryStats(logs: ActivityLogRow[]): string {
  const totals = new Map<ActivityCategory, number>()
  for (const log of logs) {
    const cat = (log.category ?? 'other') as ActivityCategory
    totals.set(cat, (totals.get(cat) ?? 0) + (log.ended_at - log.started_at))
  }
  const totalMs = [...totals.values()].reduce((a, b) => a + b, 0) || 1
  const rows = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, ms]) => {
      const pct = Math.round((ms / totalMs) * 100)
      return `| ${CATEGORY_LABELS[cat]} | ${formatDurationMinutes(ms)} | ${pct}% |`
    })
  return ['| 分类 | 时长 | 占比 |', '|------|------|------|', ...rows].join('\n')
}

async function buildActivityTimelineText(
  logs: ActivityLogRow[],
  sinceMs: number
): Promise<string> {
  const aggregated = aggregateActivities(logs)
  const projects = [...new Set(aggregated.map(a => a.project).filter(Boolean))] as string[]
  const gitMap = await collectGitCommitsForProjects(projects, sinceMs)

  return aggregated
    .map(item => {
      const durationMs = item.endedAt - item.startedAt
      const commits = item.project ? gitMap.get(item.project)?.map(c => c.message) : undefined
      const summary = buildLocalActivitySummary(
        item.category,
        item.project,
        item.file,
        durationMs,
        commits
      )
      const safe = buildAiSafeSummary(item.category, item.project, item.file, durationMs, commits)
      const gitLine =
        safe.gitCommits?.length ? `\n  - Git: ${safe.gitCommits.join('; ')}` : ''
      return `- ${formatTime(item.startedAt)}–${formatTime(item.endedAt)} | ${safe.categoryLabel} | ${summary}${gitLine}`
    })
    .join('\n')
}

function buildOfflineGroupedByProject(logs: ActivityLogRow[]): string {
  const agg = aggregateActivities(logs)
  if (agg.length === 0) return '（无记录）'

  type Bucket = { totalMs: number; byCat: Map<ActivityCategory, number>; files: Map<string, number> }
  const byProject = new Map<string, Bucket>()

  for (const a of agg) {
    const pk = a.project?.trim() ? a.project.trim() : '未标注项目'
    if (!byProject.has(pk)) {
      byProject.set(pk, { totalMs: 0, byCat: new Map(), files: new Map() })
    }
    const b = byProject.get(pk)!
    const ms = a.endedAt - a.startedAt
    b.totalMs += ms
    const cat = a.category
    b.byCat.set(cat, (b.byCat.get(cat) ?? 0) + ms)
    if (a.file) {
      const base = a.file.split(/[/\\]/).pop() ?? a.file
      b.files.set(base, (b.files.get(base) ?? 0) + ms)
    }
  }

  const lines: string[] = []
  const sorted = [...byProject.entries()].sort((x, y) => y[1].totalMs - x[1].totalMs)
  for (const [proj, bucket] of sorted) {
    lines.push(`#### ${proj}（${formatDurationMinutes(bucket.totalMs)}）`)
    const cats = [...bucket.byCat.entries()].sort((a, b) => b[1] - a[1])
    for (const [cat, ms] of cats) {
      lines.push(`- ${CATEGORY_LABELS[cat]}：${formatDurationMinutes(ms)}`)
    }
    const topFiles = [...bucket.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    if (topFiles.length > 0) {
      lines.push(
        `- 主要文件：` +
          topFiles.map(([f, ms]) => `\`${f}\`（${formatDurationMinutes(ms)}）`).join('、')
      )
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

/** 离线报告：突出归类汇总；时间线只保留时长最长的若干「工作块」，避免等同原始时间轴。 */
function buildOfflineReport(
  title: string,
  logs: ActivityLogRow[],
  sinceMs: number,
  gitSummary: string
): string {
  const dateLabel = new Date(sinceMs).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const agg = aggregateActivities(logs)
  const topBlocks = [...agg]
    .map(a => ({
      ms: a.endedAt - a.startedAt,
      line: `- ${formatTime(a.startedAt)}–${formatTime(a.endedAt)} | ${buildLocalActivitySummary(
        a.category,
        a.project,
        a.file,
        a.endedAt - a.startedAt
      )}`
    }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 18)
    .map(x => x.line)
    .join('\n')

  const grouped = buildOfflineGroupedByProject(logs)

  return `## ${title}（${dateLabel}）

> 离线模式：未调用 AI，以下为结构化活动摘要。

### 时间分配
${buildCategoryStats(logs)}

### 按项目归类（相邻同屏已合并）
${grouped}

### 主要工作块（按时长）
${topBlocks || '（无记录）'}

### Git 活动
${gitSummary || '（无 Git 记录）'}
`
}

function formatFetchError(err: unknown, url: string): string {
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  })()
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : err instanceof Error && typeof err.cause === 'string'
        ? err.cause
        : ''
  const base = err instanceof Error ? err.message : String(err)
  if (base === 'fetch failed' || base.includes('fetch failed')) {
    return `无法连接 AI 服务（${host}）${cause ? `：${cause}` : ''}。请检查网络/代理、API 地址（设置 → AI），或开启离线模式后重试。`
  }
  return base
}

export function shouldUseOfflineReport(): boolean {
  return (
    readSetting('offline_mode', 'false') === 'true' ||
    !readSetting('api_key', '').trim() ||
    !canUseCloudAi()
  )
}

export async function callChatCompletion(prompt: string, system: string): Promise<string> {
  const config = resolveAiConfig()
  if (!config) throw new Error('请先配置 API Key')

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(120_000)
    })
  } catch (err) {
    throw new Error(formatFetchError(err, url))
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI 请求失败 (${response.status}): ${text.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('AI 返回内容为空')
  return content
}

export interface GenerateReportResult {
  content: string
  mode: 'ai' | 'offline'
  degradedFromAi?: boolean
  degradationReason?: string
}

export async function generateDailyReport(dateMs: number): Promise<GenerateReportResult> {
  const start = new Date(dateMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateMs)
  end.setHours(23, 59, 59, 999)

  const { items } = listActivityLogs({
    startTime: start.getTime(),
    endTime: end.getTime(),
    limit: 500
  })

  // 离线模式用简版 git 汇总
  const projects = [...new Set(items.map(i => i.parsed_project).filter(Boolean))] as string[]
  const gitMapOffline = await collectGitCommitsForProjects(projects, start.getTime())
  const gitSummary = [...gitMapOffline.entries()]
    .flatMap(([, commits]) => commits.map(c => `- \`${c.message}\``))
    .join('\n')

  const offlineContent = buildOfflineReport('今日工作摘要', items, start.getTime(), gitSummary)

  if (shouldUseOfflineReport()) {
    return { content: offlineContent, mode: 'offline' }
  }

  const workUnits = await buildWorkUnits(items, start.getTime())
  const workUnitText = workUnits.length > 0
    ? workUnits.map((u, i) => formatWorkUnitForPrompt(u, i + 1)).join('\n\n')
    : '（今日无活动记录）'
  const template = loadPromptFile('daily-report-v2.md')
  const prompt = template.replace('{{work_units}}', workUnitText)

  try {
    const raw = await callChatCompletion(
      prompt,
      '你是专业的工作汇报助手。输出简洁、可直接阅读的中文 Markdown 日报。禁止开场白，直接从 ## 标题开始。'
    )
    return { content: normalizeAiReportContent(raw), mode: 'ai' }
  } catch (err) {
    return {
      content: offlineContent,
      mode: 'offline',
      degradedFromAi: true,
      degradationReason: err instanceof Error ? err.message : 'AI 请求失败'
    }
  }
}

export async function generateWeeklyReport(weekStartMs: number): Promise<GenerateReportResult> {
  const start = new Date(weekStartMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(weekStartMs)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  const { items } = listActivityLogs({
    startTime: start.getTime(),
    endTime: end.getTime(),
    limit: 2000
  })

  // 离线模式用简版 git 汇总
  const projects = [...new Set(items.map(i => i.parsed_project).filter(Boolean))] as string[]
  const gitMapOffline = await collectGitCommitsForProjects(projects, start.getTime())
  const gitSummary = [...gitMapOffline.entries()]
    .flatMap(([proj, commits]) =>
      commits.map(c => `- [${proj}] \`${c.message}\``)
    )
    .join('\n')

  const offlineContent = buildOfflineReport('本周工作摘要', items, start.getTime(), gitSummary)

  if (shouldUseOfflineReport()) {
    return { content: offlineContent, mode: 'offline' }
  }

  const workUnits = await buildWorkUnits(items, start.getTime())
  const workUnitText = workUnits.length > 0
    ? workUnits.map((u, i) => formatWorkUnitForPrompt(u, i + 1)).join('\n\n')
    : '（本周无活动记录）'
  const template = loadPromptFile('weekly-report-v2.md')
  const prompt = template
    .replace('{{work_units}}', workUnitText)
    .replace('{{git_summary}}', gitSummary || '（无 Git 记录）')

  try {
    const raw = await callChatCompletion(
      prompt,
      '你是专业的工作汇报助手。输出简洁、可直接阅读的中文 Markdown 周报。禁止开场白，直接从 ## 标题开始。'
    )
    return { content: normalizeAiReportContent(raw), mode: 'ai' }
  } catch (err) {
    return {
      content: offlineContent,
      mode: 'offline',
      degradedFromAi: true,
      degradationReason: err instanceof Error ? err.message : 'AI 请求失败'
    }
  }
}

export function saveReport(
  type: 'daily' | 'weekly',
  dateStart: number,
  dateEnd: number,
  content: string
): number {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO reports (type, date_start, date_end, content, status, created_at)
       VALUES (?, ?, ?, ?, 'draft', ?)`
    )
    .run(type, dateStart, dateEnd, content, Date.now())
  return Number(result.lastInsertRowid)
}

export function getLatestReport(type: 'daily' | 'weekly'): {
  id: number
  content: string
  date_start: number
  date_end: number
  created_at: number
} | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id, content, date_start, date_end, created_at FROM reports
       WHERE type = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(type) as
    | { id: number; content: string; date_start: number; date_end: number; created_at: number }
    | undefined
  return row ?? null
}

export interface StoredReportRow {
  id: number
  type: 'daily' | 'weekly'
  content: string
  date_start: number
  date_end: number
  created_at: number
}

/**
 * 列出窗口内最近保存的日报 / 周报（同窗口同 type 仅保留最新一条，避免重复草稿）。
 * 用「与窗口有交集」判定，便于复盘选定的 [dateStart, dateEnd] 跨周时也能命中。
 */
export function listReportsInRange(options: {
  dateStart: number
  dateEnd: number
  types?: Array<'daily' | 'weekly'>
  limit?: number
}): StoredReportRow[] {
  const db = getDb()
  const types = options.types ?? ['daily', 'weekly']
  if (types.length === 0) return []
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200))
  const placeholders = types.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT id, type, content, date_start, date_end, created_at FROM reports
       WHERE type IN (${placeholders})
         AND date_start <= ? AND date_end >= ?
       ORDER BY date_start ASC, created_at DESC
       LIMIT ?`
    )
    .all(...types, options.dateEnd, options.dateStart, limit) as StoredReportRow[]

  const seen = new Set<string>()
  const out: StoredReportRow[] = []
  for (const r of rows) {
    const key = `${r.type}:${r.date_start}:${r.date_end}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

/** 取某一「自然日」或「自然周」窗口内最近一次保存的报告（与 saveReport 写入的 date_start/end 对齐）。 */
export function getReportForPeriod(
  type: 'daily' | 'weekly',
  dateStart: number,
  dateEnd: number
): {
  id: number
  content: string
  date_start: number
  date_end: number
  created_at: number
} | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id, content, date_start, date_end, created_at FROM reports
       WHERE type = ? AND date_start = ? AND date_end = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(type, dateStart, dateEnd) as
    | { id: number; content: string; date_start: number; date_end: number; created_at: number }
    | undefined
  return row ?? null
}
