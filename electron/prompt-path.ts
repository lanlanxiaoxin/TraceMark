import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/** 开发态与打包后均能定位 prompts/*.md（打包时通过 extraResources 复制到 resources/prompts）。 */
export function loadPromptFile(filename: string): string {
  const candidates = [
    join(process.cwd(), 'prompts', filename),
    join(process.resourcesPath, 'prompts', filename),
    join(app.getAppPath(), 'prompts', filename),
    join(__dirname, '../../prompts', filename),
    join(__dirname, '../../../prompts', filename)
  ]
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8')
  }
  throw new Error(`Prompt file not found: ${filename}`)
}
