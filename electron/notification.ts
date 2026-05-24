import { Notification, BrowserWindow, app } from 'electron'
import { getDb } from './database'
import { currentWeekStartMs } from './date-bounds'
import { recordLocalMetric } from './local-metrics'
import { tElectron } from './ui-locale'

let checkTimer: ReturnType<typeof setInterval> | null = null
let lastDailyNotify: string | null = null
let lastWeeklyNotify: number | null = null

function readSetting(key: string, fallback: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

function getWeekNumber(d: Date): number {
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - startOfYear.getTime()
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7)
}

function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  win.setSkipTaskbar(false)
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

function navigateToWeeklyBattle(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  focusMainWindow()
  const weekStartMs = currentWeekStartMs()
  try {
    recordLocalMetric('weekly_battle_opened', { weekStartMs })
  } catch {
    /* ignore */
  }
  win.webContents.send('app:navigate', {
    page: 'reports',
    intent: { type: 'weekly', dateMs: weekStartMs, autoGenerate: true }
  })
}

function showDailyReportNotification(): void {
  const notif = new Notification({
    title: tElectron('electron.notifyDailyTitle'),
    body: tElectron('electron.notifyDailyBody')
  })
  notif.on('click', focusMainWindow)
  notif.show()
}

function showWeeklyBattleNotification(): void {
  const notif = new Notification({
    title: tElectron('electron.notifyFridayTitle'),
    body: tElectron('electron.notifyFridayBody')
  })
  notif.on('click', navigateToWeeklyBattle)
  notif.show()
}

export function initNotificationScheduler(): void {
  stopNotificationScheduler()

  checkTimer = setInterval(() => {
    const enabled = readSetting('daily_reminder_enabled', 'true') === 'true'
    const fridayReminder = readSetting('friday_reminder_enabled', 'true') === 'true'

    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const hour = now.getHours()
    const minute = now.getMinutes()
    const dayOfWeek = now.getDay()

    const dailyTime = readSetting('daily_reminder_time', '18:00')
    const [dailyHour, dailyMinute] = dailyTime.split(':').map(Number)
    if (enabled && hour === dailyHour && minute === dailyMinute && lastDailyNotify !== today) {
      lastDailyNotify = today
      showDailyReportNotification()
    }

    const fridayTime = readSetting('friday_reminder_time', '17:00')
    const [friHour, friMinute] = fridayTime.split(':').map(Number)
    if (fridayReminder && dayOfWeek === 5 && hour === friHour && minute === friMinute) {
      const weekNum = getWeekNumber(now)
      if (lastWeeklyNotify !== weekNum) {
        lastWeeklyNotify = weekNum
        showWeeklyBattleNotification()
      }
    }
  }, 60_000)

  app.on('before-quit', stopNotificationScheduler)
}

export function stopNotificationScheduler(): void {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
  lastDailyNotify = null
  lastWeeklyNotify = null
}
