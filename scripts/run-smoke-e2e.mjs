/**
 * 在 Electron 的 Node 运行时执行 smoke-e2e（与 better-sqlite3 原生模块 ABI 一致）。
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const electronPath = require('electron')
const tsxCli = path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const smokeEntry = path.join(__dirname, 'smoke-e2e.ts')

const result = spawnSync(
  electronPath,
  [tsxCli, smokeEntry],
  {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
    windowsHide: true
  }
)

if (result.error) {
  console.error(result.error)
  process.exit(1)
}
process.exit(result.status === null ? 1 : result.status)
