import type { ActivityProvider, ActivityProviderStatus, ActiveWindowInfo } from './types'
import { windowsActivityProvider } from './windows'
import { macActivityProvider } from './macos'
import { linuxActivityProvider } from './linux'

export type { ActiveWindowInfo, ActivityProvider, ActivityProviderStatus, ActivityPlatform } from './types'

let cachedProvider: ActivityProvider | null = null

export function getActivityProvider(): ActivityProvider {
  if (cachedProvider) return cachedProvider
  if (process.platform === 'win32') cachedProvider = windowsActivityProvider
  else if (process.platform === 'darwin') cachedProvider = macActivityProvider
  else cachedProvider = linuxActivityProvider
  return cachedProvider
}

export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  return getActivityProvider().getActiveWindow()
}

export async function getActivityProviderStatus(): Promise<ActivityProviderStatus> {
  const provider = getActivityProvider()
  const sample = await provider.getActiveWindow()
  const labels: Record<string, string> = {
    win32: 'Windows（完整采集）',
    darwin: 'macOS（前台窗口 PoC）',
    linux: 'Linux（预留）'
  }
  return {
    platform: provider.platform,
    available: sample != null,
    label: labels[provider.platform] ?? provider.platform,
    explainPermissions: provider.explainPermissions()
  }
}
