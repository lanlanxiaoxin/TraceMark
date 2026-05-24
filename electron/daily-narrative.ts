import { listActivityLogs } from './activity-logs'
import { dayBounds } from './work-asset-generator'
import { CATEGORY_LABELS, type ActivityCategory } from './window-title-parser'
import { sanitizeTextForCloud } from './sanitizer'
import { callChatCompletion, shouldUseOfflineReport } from './ai-gateway'
import { getReportLocale, reportSystemPrompt } from './report-prompts'

function formatMins(ms: number): string {
  return `${Math.round(ms / 60000)} 分钟`
}

/** 规则版「每日叙事」：不调用 AI，仅基于 activity_logs 统计。 */
export function buildDailyNarrativePlain(dateMs: number): string {
  const { start, end } = dayBounds(dateMs)
  const { items } = listActivityLogs({ startTime: start, endTime: end, limit: 4000 })
  if (items.length === 0) {
    return '今日尚无前台活动记录。开启进程监听并正常使用电脑后，这里会生成一段基于统计的当日叙事。'
  }

  let coding = 0
  let browser = 0
  let docs = 0
  let comm = 0
  let other = 0
  for (const l of items) {
    const ms = l.ended_at - l.started_at
    const c = (l.category ?? 'other') as ActivityCategory
    if (c === 'code_editor' || c === 'terminal') coding += ms
    else if (c === 'browser') browser += ms
    else if (c === 'docs' || c === 'design') docs += ms
    else if (c === 'communication' || c === 'meeting') comm += ms
    else other += ms
  }

  const projMap = new Map<string, number>()
  for (const l of items) {
    const p = l.parsed_project?.trim()
    if (!p) continue
    projMap.set(p, (projMap.get(p) ?? 0) + (l.ended_at - l.started_at))
  }
  const topProjects = [...projMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const main = topProjects[0]

  const sorted = [...items].sort((a, b) => a.started_at - b.started_at)
  let sessions = 0
  let lastEnd = 0
  for (const l of sorted) {
    if (lastEnd === 0 || l.started_at - lastEnd > 12 * 60 * 1000) sessions += 1
    lastEnd = Math.max(lastEnd, l.ended_at)
  }
  const frag = Math.min(10, Math.max(1, Math.round(sessions / 2)))

  const parts: string[] = []
  if (main) {
    parts.push(
      `今天在解析到的项目维度里，「${main[0]}」占用前台时间最长（约 ${formatMins(main[1])}）。`
    )
  } else {
    parts.push('今天窗口标题里较少出现可识别的项目/仓库名，建议为常用项目配置项目空间与别名，叙事会更准。')
  }

  parts.push(
    `${CATEGORY_LABELS.code_editor}与终端合计约 ${formatMins(coding)}，` +
      `${CATEGORY_LABELS.browser}约 ${formatMins(browser)}，` +
      `文档与设计约 ${formatMins(docs)}，` +
      `沟通与会议约 ${formatMins(comm)}，其余约 ${formatMins(other)}。`
  )

  if (topProjects.length > 1) {
    parts.push(
      `次要项目还包括：${topProjects
        .slice(1)
        .map(([n, ms]) => `${n}（${formatMins(ms)}）`)
        .join('、')}。`
    )
  }

  parts.push(
    `按 12 分钟以上的中断粗略切段，约有 ${sessions} 段独立「工作窗口」；碎片化指数 ${frag}/10（越高表示切换越频繁）。`
  )

  if (coding >= 20 * 60 * 1000 && browser > coding * 0.47) {
    parts.push(
      '提示：浏览器可见时长与编码接近或更高——若你主观上觉得「写了一天代码却产出不多」，很可能时间花在检索、文档与来回切换上。'
    )
  }

  return parts.join('')
}

/** 供上传预览与云端润色使用的脱敏活动摘要（最多 limit 条）。 */
export function buildDailyNarrativePromptPayload(dateMs: number, limit = 120): string {
  const { start, end } = dayBounds(dateMs)
  const { items } = listActivityLogs({ startTime: start, endTime: end, limit })
  const parts: string[] = []
  for (const log of items) {
    const cat = (log.category ?? 'other') as ActivityCategory
    const label = CATEGORY_LABELS[cat]
    const title =
      sanitizeTextForCloud(log.sanitized_title) ||
      sanitizeTextForCloud(log.parsed_file) ||
      log.process_name
    const project = sanitizeTextForCloud(log.parsed_project)
    parts.push(
      `- ${label}${project ? ` | ${project}` : ''}: ${title}（${Math.max(1, Math.round((log.ended_at - log.started_at) / 60000))} 分钟）`
    )
  }
  return parts.join('\n') || '（无活动）'
}

export async function generateDailyNarrativeAi(dateMs: number): Promise<{
  content: string
  mode: 'ai' | 'offline'
  degradedFromAi?: boolean
  degradationReason?: string
}> {
  const plain = buildDailyNarrativePlain(dateMs)
  if (shouldUseOfflineReport()) {
    return { content: plain, mode: 'offline' }
  }
  const bullets = buildDailyNarrativePromptPayload(dateMs, 120)
  const user =
    getReportLocale() === 'en'
      ? `Polish the rule-based draft below into a natural first-person or neutral paragraph in English. It must not contradict the activity summary.\n\n【Rule-based draft】\n${plain}\n\n【Activity summary】\n${bullets}`
      : `请将下列「规则叙事草稿」润色为一段更自然的第一人称或中性叙述，并确保与「活动摘要」不矛盾。\n\n【规则叙事草稿】\n${plain}\n\n【活动摘要】\n${bullets}`
  try {
    const content = await callChatCompletion(user, reportSystemPrompt('dailyNarrative'))
    return { content: content.trim(), mode: 'ai' }
  } catch (err) {
    return {
      content: plain,
      mode: 'offline',
      degradedFromAi: true,
      degradationReason: err instanceof Error ? err.message : 'AI 请求失败'
    }
  }
}
