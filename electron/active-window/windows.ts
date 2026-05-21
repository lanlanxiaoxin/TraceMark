import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ActiveWindowInfo, ActivityProvider } from './types'

const execFileAsync = promisify(execFile)

const PS_GET_FOREGROUND = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win32Foreground {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@
$hwnd = [Win32Foreground]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { exit 1 }
$title = New-Object System.Text.StringBuilder 512
[void][Win32Foreground]::GetWindowTextW($hwnd, $title, 512)
$processId = 0
[void][Win32Foreground]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
$payload = @{
  processName = if ($proc) { $proc.ProcessName } else { "unknown" }
  windowTitle = $title.ToString()
  executablePath = if ($proc -and $proc.Path) { $proc.Path } else { "" }
} | ConvertTo-Json -Compress
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload))
`

function decodePowerShellPayload(stdout: string | Buffer): string {
  const text = Buffer.isBuffer(stdout) ? stdout.toString('ascii').trim() : stdout.trim()
  return Buffer.from(text, 'base64').toString('utf8')
}

export async function getWindowsActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_GET_FOREGROUND],
      { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 64, encoding: 'buffer' }
    )
    const raw = JSON.parse(decodePowerShellPayload(stdout)) as {
      processName?: string
      windowTitle?: string
      executablePath?: string
    }
    const processName = raw.processName?.trim() ?? ''
    const windowTitle = raw.windowTitle?.trim() ?? ''
    if (!processName && !windowTitle) return null
    return {
      processName: processName || 'unknown',
      windowTitle,
      executablePath: raw.executablePath?.trim() ?? ''
    }
  } catch {
    return null
  }
}

export const windowsActivityProvider: ActivityProvider = {
  platform: 'win32',
  getActiveWindow: getWindowsActiveWindow,
  explainPermissions: () => 'Windows 前台窗口采集无需额外系统授权。'
}
