export async function getAllSettings(): Promise<Record<string, string>> {
  return window.electronAPI.getSettings()
}

export async function getSetting(key: string): Promise<string | null> {
  return window.electronAPI.getSetting(key)
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  return window.electronAPI.setSetting(key, value)
}

export async function getAppVersion(): Promise<string> {
  return window.electronAPI.getAppVersion()
}
