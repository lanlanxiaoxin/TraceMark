import { getUiLocaleSync } from './ui-locale'
import { loadPromptFile } from './prompt-path'

export type ReportLocale = 'zh' | 'en'

export function getReportLocale(): ReportLocale {
  return getUiLocaleSync()
}

/** `daily-report-v3.md` → `daily-report-v3.en.md` when UI is English. */
export function loadLocalizedPrompt(baseFilename: string): string {
  if (getReportLocale() === 'en') {
    const enName = baseFilename.replace(/\.md$/i, '.en.md')
    try {
      return loadPromptFile(enName)
    } catch {
      /* fall through to zh */
    }
  }
  return loadPromptFile(baseFilename)
}

export type ReportSystemKind =
  | 'dailyLegacy'
  | 'dailySeal'
  | 'weeklyLegacy'
  | 'weeklyBattle'
  | 'dailyNarrative'
  | 'weeklyRetro'
  | 'projectPhaseRetro'

const REPORT_SYSTEM: Record<ReportSystemKind, Record<ReportLocale, string>> = {
  dailyLegacy: {
    zh: '你是专业的工作汇报助手。输出简洁、可直接阅读的中文 Markdown 日报。禁止开场白，直接从 ## 标题开始。',
    en: 'You are a professional work-report assistant. Output concise, readable English Markdown for a daily report. No preamble or filler; start directly with ## headings. Source context may be in Chinese—translate faithfully; do not invent facts.'
  },
  dailySeal: {
    zh: '你是专业的工作汇报助手。输出简洁、可直接阅读的中文 Markdown 日报。禁止开场白，直接从 ## 标题开始。必须保留盖章主线与五段式结构。',
    en: 'You are a professional work-report assistant. Output concise English Markdown for a daily report. No preamble; start with ## headings. Preserve the seal mainline and the five-section structure exactly as instructed. Source context may be in Chinese—translate faithfully; do not invent facts.'
  },
  weeklyLegacy: {
    zh: '你是专业的工作汇报助手。输出简洁、可直接阅读的中文 Markdown 周报。禁止开场白，直接从 ## 标题开始。',
    en: 'You are a professional work-report assistant. Output concise English Markdown for a weekly report. No preamble; start directly with ## headings. Source context may be in Chinese—translate faithfully; do not invent facts.'
  },
  weeklyBattle: {
    zh: '你是专业的工作汇报助手。输出简洁、可直接分享的本周战报 Markdown。禁止开场白，保留成果/突破/卡点结构。',
    en: 'You are a professional work-report assistant. Output concise, shareable English Markdown for a weekly battle report. No preamble; keep outcomes / breakthroughs / blockers structure. Source context may be in Chinese—translate faithfully; do not invent facts.'
  },
  dailyNarrative: {
    zh: '你是专业的工作叙事助手。只根据用户提供的「规则叙事草稿」和「活动摘要」写作，不得编造未出现的项目、时长或工具。输出一段连贯中文（220–400 字），语气克制、适合向同事口述今日工作重点。',
    en: 'You are a professional work-narrative assistant. Write only from the rule-based draft and activity summary provided; do not invent projects, durations, or tools. Output one coherent English paragraph (120–220 words), restrained tone, suitable for telling a colleague what mattered today. Source context may be in Chinese—translate faithfully.'
  },
  weeklyRetro: {
    zh: '你是个人工作复盘助手。仅根据用户已确认的工作资产生成周复盘，不要编造未列出的交付。输出中文 Markdown。列表仅用 `- ` 开头，禁止 `-*`、`- *`、单独 `*` 作列表符或 `---` 分隔线。',
    en: 'You are a personal weekly retrospective assistant. Use only confirmed work assets; do not invent deliveries. Output English Markdown. Bullets must use `- ` only—never `-*`, `- *`, lone `*` bullets, or `---` rules. Source context may be in Chinese—translate faithfully.'
  },
  projectPhaseRetro: {
    zh: '你是个人项目复盘助手。仅根据用户已确认的工作资产生成项目阶段复盘，突出成果、决策与待跟进。输出中文 Markdown。列表仅用 `- ` 开头，禁止 `-*`、`- *`、单独 `*` 作列表符或 `---` 分隔线。',
    en: 'You are a personal project retrospective assistant. Use only confirmed work assets; highlight outcomes, decisions, and follow-ups. Output English Markdown. Bullets must use `- ` only—never `-*`, `- *`, lone `*` bullets, or `---` rules. Source context may be in Chinese—translate faithfully.'
  }
}

export function reportSystemPrompt(kind: ReportSystemKind): string {
  const locale = getReportLocale()
  return REPORT_SYSTEM[kind][locale]
}
