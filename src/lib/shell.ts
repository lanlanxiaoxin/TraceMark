export function openExternalUrl(url: string): Promise<boolean> {
  return window.electronAPI.openExternalUrl(url)
}
