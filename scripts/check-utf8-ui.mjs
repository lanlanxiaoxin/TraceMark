import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

/** UI 文案误写成 ??? 的检测（排除 ?? 空值合并） */
const BAD = /['"`][^'"`]*\?{3,}[^'"`]*['"`]|>\?{3,}</

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

let failed = false
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    if (line.includes('??') && !BAD.test(line)) continue
    if (BAD.test(line)) {
      console.error(`${file}: ${line.trim()}`)
      failed = true
    }
  }
}

if (failed) {
  console.error('\n发现疑似 UTF-8 损坏（???）。请运行: python scripts/fix-utf8-projects.py')
  process.exit(1)
}
console.log('UTF-8 UI check OK')
