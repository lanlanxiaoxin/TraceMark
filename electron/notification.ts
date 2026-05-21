import { Notification, BrowserWindow, app } from 'electron'
import { getDb } from './database'

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

function showDailyReportNotification(): void {
  const notif = new Notification({
    title: 'TraceMack — 日报提醒',
    body: '今日工作记录已就绪，点击查看时间轴并生成日报。'
  })
  notif.on('click', focusMainWindow)
  notif.show()
}

function showWeeklyReportNotification(): void {
  const notif = new Notification({
    title: 'TraceMack — 周报提醒',
    body: '本周工作记录已就绪，点击查看并生成周报。'
  })
  notif.on('click', focusMainWindow)
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

    // Daily reminder at configurable time
    const dailyTime = readSetting('daily_reminder_time', '18:00')
    const [dailyHour, dailyMinute] = dailyTime.split(':').map(Number)
    if (enabled && hour === dailyHour && minute === dailyMinute && lastDailyNotify !== today) {
      lastDailyNotify = today
      showDailyReportNotification()
    }

    // Friday weekly reminder at configurable time (dayOfWeek === 5 = Friday)
    const fridayTime = readSetting('friday_reminder_time', '16:00')
    const [friHour, friMinute] = fridayTime.split(':').map(Number)
    if (fridayReminder && dayOfWeek === 5 && hour === friHour && minute === friMinute) {
      const weekNum = getWeekNumber(now)
      if (lastWeeklyNotify !== weekNum) {
        lastWeeklyNotify = weekNum
        showWeeklyReportNotification()
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
