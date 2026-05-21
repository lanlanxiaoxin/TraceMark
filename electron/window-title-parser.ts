export type ActivityCategory =
  | 'code_editor'
  | 'terminal'
  | 'browser'
  | 'design'
  | 'docs'
  | 'communication'
  | 'meeting'
  | 'file_manager'
  | 'other'

export interface ParsedWindowTitle {
  category: ActivityCategory
  parsedProject: string | null
  parsedFile: string | null
  isGitRepo: boolean
}

const FILE_EXT_RE = /\.[a-zA-Z0-9]{1,10}$/

export const DEFAULT_PROCESS_CATEGORIES: Record<string, ActivityCategory> = {
  // === 编辑器 / IDE ===
  code: 'code_editor',
  cursor: 'code_editor',
  'code - insiders': 'code_editor',
  'codebuddy cn': 'code_editor',
  idea64: 'code_editor',
  pycharm64: 'code_editor',
  webstorm64: 'code_editor',
  goland64: 'code_editor',
  devenv: 'code_editor',
  clion64: 'code_editor',
  rubymine64: 'code_editor',
  phpstorm64: 'code_editor',
  androidstudio: 'code_editor',
  studio64: 'code_editor',
  sublime_text: 'code_editor',
  'notepadplusplus': 'code_editor',
  'notepad++': 'code_editor',
  hbuilderx: 'code_editor',
  unity: 'code_editor',
  rider64: 'code_editor',
  datagrip: 'code_editor',
  rustrover: 'code_editor',

  // === 终端 ===
  windowsterminal: 'terminal',
  wt: 'terminal',
  'wezterm-gui': 'terminal',
  powershell: 'terminal',
  pwsh: 'terminal',
  cmd: 'terminal',
  alacritty: 'terminal',
  kitty: 'terminal',
  konsole: 'terminal',
  'gnome-terminal': 'terminal',
  hyper: 'terminal',
  tabby: 'terminal',
  warp: 'terminal',
  cmder: 'terminal',
  conemu: 'terminal',
  mobaxterm: 'terminal',
  electerm: 'terminal',

  // === 浏览器 ===
  chrome: 'browser',
  msedge: 'browser',
  firefox: 'browser',
  brave: 'browser',
  opera: 'browser',
  vivaldi: 'browser',
  arc: 'browser',
  floorp: 'browser',
  librewolf: 'browser',
  chromium: 'browser',
  safari: 'browser',
  yandex: 'browser',
  thorium: 'browser',
  '360chrome': 'browser',
  qqbrowser: 'browser',
  centbrowser: 'browser',

  // === 设计 ===
  figma: 'design',
  sketch: 'design',
  photoshop: 'design',
  illustrator: 'design',
  affinity: 'design',
  gimp: 'design',
  inkscape: 'design',
  blender: 'design',
  canva: 'design',

  // === 文档 / 笔记 ===
  winword: 'docs',
  excel: 'docs',
  powerpnt: 'docs',
  wps: 'docs',
  wpp: 'docs',
  libreoffice: 'docs',
  obsidian: 'docs',
  notion: 'docs',
  typora: 'docs',
  marktext: 'docs',
  yuque: 'docs',
  onenote: 'docs',
  evernote: 'docs',
  xmind: 'docs',
  drawio: 'docs',
  'adobe reader': 'docs',
  foxitreader: 'docs',

  // === 通信 ===
  wechat: 'communication',
  dingtalk: 'communication',
  feishu: 'communication',
  lark: 'communication',
  slack: 'communication',
  discord: 'communication',
  telegram: 'communication',
  whatsapp: 'communication',
  qq: 'communication',
  tim: 'communication',
  skype: 'communication',
  element: 'communication',

  // === 会议 ===
  zoom: 'meeting',
  wemeetapp: 'meeting',
  teams: 'meeting',
  webex: 'meeting',
  'tencent-meeting': 'meeting',
  voovmeeting: 'meeting',
  jitsi: 'meeting',
  skype4b: 'meeting',

  // === 文件管理 ===
  explorer: 'file_manager',
  finder: 'file_manager',
  nautilus: 'file_manager',
  dolphin: 'file_manager',
  totalcmd: 'file_manager',
  doublecmd: 'file_manager',
  everything: 'file_manager',
  utools: 'file_manager',
  flowlauncher: 'file_manager'
}

const EDITOR_SUFFIXES = [
  / — Visual Studio Code$/i,
  / — Code$/i,
  / — Cursor$/i,
  / — CodeBuddy CN$/i,
  / — IntelliJ IDEA$/i,
  / — PyCharm$/i,
  / — WebStorm$/i,
  / — GoLand$/i
]

const BROWSER_SUFFIXES = [
  / — Google Chrome$/i,
  / — Microsoft Edge$/i,
  / — Mozilla Firefox$/i,
  / — Brave$/i,
  / — Opera$/i
]

function normalizeProcessName(name: string): string {
  return name.toLowerCase().replace(/\.exe$/i, '')
}

function classifyByProcess(
  processName: string,
  categoryOverrides?: Record<string, ActivityCategory>
): ActivityCategory {
  const key = normalizeProcessName(processName)
  // 自定义映射优先，其次默认映射，最后 'other'
  return categoryOverrides?.[key] ?? DEFAULT_PROCESS_CATEGORIES[key] ?? 'other'
}

function stripSuffix(title: string, patterns: RegExp[]): string {
  let result = title.trim()
  for (const pattern of patterns) {
    result = result.replace(pattern, '').trim()
  }
  return result
}

function splitSegments(text: string): string[] {
  return text
    .split(/\s*[—–-]\s*/)
    .map(s => s.trim())
    .filter(Boolean)
}

function looksLikeFile(segment: string): boolean {
  return FILE_EXT_RE.test(segment.replace(/^[●◉]\s*/, '').trim())
}

function parseEditorTitle(title: string): { project: string | null; file: string | null; isGitRepo: boolean } {
  let body = stripSuffix(title, EDITOR_SUFFIXES)
  const isGitRepo = /[●◉]/.test(body)
  body = body.replace(/[●◉]\s*/g, '').trim()

  const segments = splitSegments(body)
  if (segments.length === 0) return { project: null, file: null, isGitRepo }

  if (segments.length === 1) {
    const only = segments[0]
    if (looksLikeFile(only)) return { project: null, file: only, isGitRepo }
    return { project: only, file: null, isGitRepo }
  }

  const first = segments[0]
  const second = segments[1]
  if (looksLikeFile(first)) {
    return { project: second, file: first, isGitRepo }
  }
  return { project: first, file: second, isGitRepo }
}

function parseBrowserTitle(title: string): { project: string | null; file: string | null } {
  const body = stripSuffix(title, BROWSER_SUFFIXES)
  const segments = splitSegments(body)
  if (segments.length === 0) return { project: null, file: null }

  const pageTitle = segments[0]
  const lower = pageTitle.toLowerCase()

  if (lower.includes('github')) {
    const prMatch = pageTitle.match(/PR\s*#?\d+/i)
    const issueMatch = pageTitle.match(/(?:issue|bug)\s*#?\d+/i)
    if (prMatch) {
      return { project: 'github.com', file: `PR review: ${prMatch[0]}` }
    }
    if (issueMatch) {
      return { project: 'github.com', file: `issue: ${issueMatch[0]}` }
    }
    return { project: 'github.com', file: pageTitle }
  }

  if (lower.includes('stackoverflow')) {
    return { project: 'stackoverflow.com', file: '技术搜索' }
  }

  if (/zhihu|csdn|juejin/.test(lower)) {
    return { project: '技术阅读', file: pageTitle }
  }

  if (lower.includes('figma')) {
    return { project: 'figma.com', file: segments.length > 1 ? segments[1] : pageTitle }
  }

  if (lower.includes('linear')) {
    const ticketMatch = pageTitle.match(/[A-Z]+-\d+/)
    return { project: 'linear.app', file: ticketMatch?.[0] ?? pageTitle }
  }

  if (lower.includes('jira')) {
    const ticketMatch = pageTitle.match(/[A-Z]+-\d+/)
    return { project: 'jira', file: ticketMatch?.[0] ?? pageTitle }
  }

  if (lower.includes('confluence')) {
    return { project: 'confluence', file: pageTitle }
  }

  if (/docs\.google\.com|google docs|google sheets/.test(lower)) {
    return { project: 'google docs', file: pageTitle }
  }

  return { project: null, file: pageTitle }
}

function parseGenericTitle(title: string, category: ActivityCategory): { project: string | null; file: string | null } {
  const segments = splitSegments(title)
  if (segments.length === 0) return { project: null, file: null }

  if (category === 'docs' || category === 'design') {
    if (looksLikeFile(segments[0])) {
      return { project: null, file: segments[0] }
    }
    return { project: segments[0], file: segments[1] ?? null }
  }

  if (category === 'communication' || category === 'meeting') {
    return { project: segments[0], file: null }
  }

  if (category === 'file_manager') {
    return { project: segments[0], file: null }
  }

  if (category === 'terminal') {
    return { project: segments.length > 1 ? segments[1] : segments[0], file: null }
  }

  return { project: segments[0], file: segments[1] ?? null }
}

export function parseWindowTitle(
  processName: string,
  windowTitle: string,
  categoryOverrides?: Record<string, ActivityCategory>
): ParsedWindowTitle {
  const category = classifyByProcess(processName, categoryOverrides)
  const title = windowTitle.trim()

  if (!title) {
    return { category, parsedProject: null, parsedFile: null, isGitRepo: false }
  }

  if (category === 'code_editor') {
    const { project, file, isGitRepo } = parseEditorTitle(title)
    return { category, parsedProject: project, parsedFile: file, isGitRepo }
  }

  if (category === 'browser') {
    const { project, file } = parseBrowserTitle(title)
    return { category, parsedProject: project, parsedFile: file, isGitRepo: false }
  }

  const { project, file } = parseGenericTitle(title, category)
  return { category, parsedProject: project, parsedFile: file, isGitRepo: false }
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  code_editor: '编码',
  terminal: '终端',
  browser: '浏览器',
  design: '设计',
  docs: '文档',
  communication: '沟通',
  meeting: '会议',
  file_manager: '文件',
  other: '其他'
}
