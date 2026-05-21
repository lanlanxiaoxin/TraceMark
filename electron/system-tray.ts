import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

let tray: Tray | null = null
let appIsQuitting = false

export function setAppQuitting(): void {
  appIsQuitting = true
}

export function isAppQuitting(): boolean {
  return appIsQuitting
}

async function resolveTrayIcon(): Promise<Electron.NativeImage> {
  const candidates = [
    join(process.resourcesPath, 'resources', 'icon.png'),
    join(process.cwd(), 'resources', 'icon.png')
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      const img = nativeImage.createFromPath(path)
      if (!img.isEmpty()) return img.resize({ width: 16, height: 16 })
    }
  }
  if (process.platform === 'win32') {
    try {
      return await app.getFileIcon(process.execPath, { size: 'small' })
    } catch {
      /* fallback */
    }
  }
  return nativeImage.createEmpty()
}

export async function initSystemTray(getMainWindow: () => BrowserWindow | null): Promise<void> {
  if (tray) return

  const icon = await resolveTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('TraceMack')

  const showMain = (): void => {
    const win = getMainWindow()
    if (!win) return
    win.setSkipTaskbar(false)
    if (!win.isVisible()) win.show()
    if (win.isMinimized()) win.restore()
    win.focus()
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 TraceMack', click: showMain },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        appIsQuitting = true
        tray?.destroy()
        tray = null
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', showMain)
}

export function attachTrayWindowBehavior(win: BrowserWindow): void {
  win.on('close', event => {
    if (appIsQuitting) return
    event.preventDefault()
    win.hide()
    win.setSkipTaskbar(true)
  })

  win.on('show', () => {
    win.setSkipTaskbar(false)
  })
}
