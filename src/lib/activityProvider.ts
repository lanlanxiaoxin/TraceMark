import type { ActivityProviderStatus } from '@/env'

export async function getActivityProviderStatus(): Promise<ActivityProviderStatus> {
  return window.electronAPI.getActivityProviderStatus()
}

export async function requestActivityPermissions(): Promise<{
  granted: boolean
  message?: string
}> {
  return window.electronAPI.requestActivityPermissions()
}
