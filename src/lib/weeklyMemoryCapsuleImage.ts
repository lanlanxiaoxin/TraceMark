import type { WeeklyMemoryCapsulePayload } from '@/env'
import i18n from '@/i18n'

const WIDTH = 1080
const HEIGHT = 1920
const PAD = 56

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = [...text]
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/** F6 周记忆胶囊：1080×1920 竖版分享图 */
export function renderWeeklyMemoryCapsulePngDataUrl(
  data: WeeklyMemoryCapsulePayload
): string {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  grad.addColorStop(0, '#312e81')
  grad.addColorStop(0.45, '#4f46e5')
  grad.addColorStop(1, '#1e1b4b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, PAD, 120, WIDTH - PAD * 2, HEIGHT - 240, 28)
  ctx.fill()

  let y = PAD + 48

  ctx.fillStyle = '#e0e7ff'
  ctx.font = '500 22px system-ui, sans-serif'
  ctx.fillText(i18n.t('weeklyCapsule.title'), PAD + 32, y)
  y += 44

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.fillText(data.weekLabel, PAD + 32, y)
  y += 56

  const pillY = y
  const pillW = (WIDTH - PAD * 2 - 64 - 24) / 3
  const pills = [
    { n: String(data.stats.assetCount), label: i18n.t('weeklyCapsule.statAssets') },
    { n: String(data.stats.sealCount), label: i18n.t('weeklyCapsule.statSeal') },
    { n: String(data.stats.outcomeCount), label: i18n.t('weeklyCapsule.statOutcome') }
  ]
  pills.forEach((pill, i) => {
    const px = PAD + 32 + i * (pillW + 12)
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    roundRect(ctx, px, pillY, pillW, 88, 16)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px system-ui, sans-serif'
    ctx.fillText(pill.n, px + 20, pillY + 44)
    ctx.fillStyle = '#c7d2fe'
    ctx.font = '18px system-ui, sans-serif'
    ctx.fillText(pill.label, px + 20, pillY + 72)
  })
  y = pillY + 108

  ctx.fillStyle = '#a5b4fc'
  ctx.font = '17px system-ui, sans-serif'
  const subLines = wrapText(ctx, data.statsSubtitle, WIDTH - PAD * 2 - 64)
  for (const line of subLines.slice(0, 2)) {
    ctx.fillText(line, PAD + 32, y)
    y += 26
  }
  y += 20

  for (const section of data.sections) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 26px system-ui, sans-serif'
    ctx.fillText(section.title, PAD + 32, y)
    y += 36

    ctx.font = '20px system-ui, sans-serif'
    for (const item of section.items.slice(0, 4)) {
      const lines = wrapText(ctx, `• ${item}`, WIDTH - PAD * 2 - 80)
      for (const line of lines.slice(0, 2)) {
        ctx.fillStyle = '#e0e7ff'
        ctx.fillText(line, PAD + 40, y)
        y += 30
      }
      y += 6
    }
    y += 16
    if (y > HEIGHT - 200) break
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText(i18n.t('weeklyCapsule.footer'), PAD + 32, HEIGHT - PAD - 24)

  return canvas.toDataURL('image/png')
}
