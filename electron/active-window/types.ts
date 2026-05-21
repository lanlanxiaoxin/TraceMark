export interface ActiveWindowInfo {
  processName: string
  windowTitle: string
  executablePath: string
}

export type ActivityPlatform = 'win32' | 'darwin' | 'linux'

export interface PermissionStatus {
  granted: boolean
  message?: string
}

export interface ActivityProvider {
  platform: ActivityPlatform
  getActiveWindow(): Promise<ActiveWindowInfo | null>
  requestPermissions?(): Promise<PermissionStatus>
  explainPermissions(): string
}

export interface ActivityProviderStatus {
  platform: ActivityPlatform
  available: boolean
  label: string
  explainPermissions: string
}
