import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase } from './database'
import { registerIpcHandlers, initProcessWatcherOnReady } from './ipc-handlers'
import { initNotificationScheduler } from './notification'
import { attachTrayWindowBehavior, initSystemTray, setAppQuitting } from './system-tray'

let mainWindow: BrowserWindow | null = null

async function loadRendererWindow(win: BrowserWindow): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    const maxRetries = 40
    for (let i = 0; i < maxRetries; i++) {
      try {
        await win.loadURL(devUrl)
        return
      } catch {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    console.error('Failed to connect to dev server:', devUrl)
    return
  }

  await win.loadFile(join(__dirname, '../renderer/index.html'))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  attachTrayWindowBehavior(mainWindow)
  void loadRendererWindow(mainWindow)
}

app.whenReady().then(async () => {
  initDatabase()
  registerIpcHandlers(() => mainWindow)
  createWindow()
  await initSystemTray(() => mainWindow)
  initProcessWatcherOnReady()
  initNotificationScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      const win = mainWindow
      if (win) {
        win.setSkipTaskbar(false)
        win.show()
        win.focus()
      }
    }
  })
})

app.on('before-quit', () => {
  setAppQuitting()
})

app.on('window-all-closed', () => {
  // macOS：关窗不退出；Windows / Linux：托盘保活，仅托盘「退出」结束进程
  if (process.platform !== 'darwin') return
})
