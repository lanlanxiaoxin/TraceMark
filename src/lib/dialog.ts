export async function pickDirectory(options?: {
  defaultPath?: string
  title?: string
  multiple?: boolean
}): Promise<string | string[] | null> {
  return window.electronAPI.pickDirectory(options)
}
