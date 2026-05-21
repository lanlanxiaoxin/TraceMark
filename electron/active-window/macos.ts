import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ActiveWindowInfo, ActivityProvider, PermissionStatus } from './types'

const execFileAsync = promisify(execFile)

const MAC_SCRIPT = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  set procName to name of frontProc
  try
    set winTitle to name of front window of frontProc
  on error
    set winTitle to ""
  end try
end tell
return procName & linefeed & winTitle
`

async function runMacScript(): Promise<{ processName: string; windowTitle: string } | null> {
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', MAC_SCRIPT], {
      timeout: 5000,
      maxBuffer: 64 * 1024
    })
    const lines = stdout.trim().split(/\r?\n/)
    const processName = lines[0]?.trim() ?? ''
    const windowTitle = lines.slice(1).join('\n').trim() || lines[0]?.trim() || ''
    if (!processName) return null
    return { processName, windowTitle: windowTitle || processName }
  } catch {
    return null
  }
}

export async function getMacActiveWindow(): Promise<ActiveWindowInfo | null> {
  const raw = await runMacScript()
  if (!raw) return null
  return {
    processName: raw.processName,
    windowTitle: raw.windowTitle,
    executablePath: ''
  }
}

export const macActivityProvider: ActivityProvider = {
  platform: 'darwin',
  getActiveWindow: getMacActiveWindow,
  async requestPermissions(): Promise<PermissionStatus> {
    const sample = await getMacActiveWindow()
    if (sample?.processName) {
      return { granted: true, message: '已成功读取前台应用。' }
    }
    return {
      granted: false,
      message:
        '请在「系统设置 → 隐私与安全性 → 辅助功能/自动化」中允许 TraceMark，并重试。'
    }
  },
  explainPermissions: () =>
    'macOS 需允许本应用通过「系统事件」读取前台应用名与窗口标题（PoC）。'
}
