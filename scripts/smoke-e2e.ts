/**
 * SQLite 端到端烟雾：采集 → 候选资产 → 盖章 → 模板日报 → 模板战报
 * 运行：npx tsx scripts/smoke-e2e.ts
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initDatabaseAtPath, closeDatabase, getDb } from '../electron/database'
import { createProjectSpace } from '../electron/project-spaces'
import { generateSuggestedAssets, dayBounds } from '../electron/work-asset-generator'
import { listWorkAssets, updateWorkAsset } from '../electron/work-assets'
import { upsertDailySeal } from '../electron/daily-seal'
import { buildTemplateDailyReportV3 } from '../electron/daily-report-v3'
import { buildTemplateWeeklyBattle, hasWeeklyBattleData } from '../electron/weekly-battle-v3'
import { searchWorkAssetsRecall, syncActivityLogFts } from '../electron/asset-search'
import type { ActivityLogRow } from '../electron/activity-logs'
import { currentWeekStartMs } from '../electron/date-bounds'

function insertSmokeActivity(
  projectLabel: string,
  startedAt: number,
  endedAt: number
): number {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO activity_logs
       (process_name, window_title, executable_path, started_at, ended_at,
        category, parsed_project, parsed_file, sanitized_title, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(
      'Code.exe',
      `${projectLabel} — auth fix`,
      'C:\\Program Files\\Code\\Code.exe',
      startedAt,
      endedAt,
      'code_editor',
      projectLabel,
      'src/auth.ts',
      'auth session refresh'
    )

  const row = db
    .prepare(
      `SELECT id, process_name, category, parsed_project, parsed_file, sanitized_title,
              started_at, ended_at, is_deleted, window_title, executable_path, enrichment_source,
              is_important, user_note
       FROM activity_logs WHERE id = ?`
    )
    .get(result.lastInsertRowid) as ActivityLogRow

  syncActivityLogFts(row)
  return row.id
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'tracemark-smoke-'))
  const dbPath = join(dir, 'smoke.db')

  try {
    initDatabaseAtPath(dbPath)

    const project = createProjectSpace({ name: 'SmokeE2E', roleTemplate: 'developer' })
    const dateMs = dayBounds(Date.now()).start
    const startedAt = dateMs + 9 * 60 * 60 * 1000
    const endedAt = startedAt + 10 * 60 * 1000

    insertSmokeActivity(project.name, startedAt, endedAt)

    const suggestedCount = generateSuggestedAssets(dateMs, true)
    assert.ok(suggestedCount >= 1, `expected suggested assets, got ${suggestedCount}`)

    const { start, end } = dayBounds(dateMs)
    const suggested = listWorkAssets({
      status: 'suggested',
      dateStart: start,
      dateEnd: end
    })
    assert.ok(suggested.length >= 1, 'no suggested cards after generation')

    const asset = suggested[0]
    updateWorkAsset(asset.id, { status: 'confirmed', title: '修复 auth 会话刷新' })

    upsertDailySeal({
      dateMs,
      projectId: project.id,
      projectName: project.name,
      note: '完成登录态修复',
      evidenceSuggested: suggested.length,
      evidenceArchived: 1,
      evidenceDismissed: 0
    })

    const daily = await buildTemplateDailyReportV3(dateMs)
    assert.match(daily, /日报/)
    assert.match(daily, /SmokeE2E|登录态|auth/i)

    const recall = await searchWorkAssetsRecall({
      query: 'auth',
      limit: 10,
      rerank: false
    })
    assert.ok(recall.items.length >= 1, 'FTS recall should find confirmed asset')
    assert.equal(recall.reranked, false)

    const weekStart = currentWeekStartMs()
    assert.ok(hasWeeklyBattleData(weekStart), 'weekly battle should have seal/asset data')

    const weekly = await buildTemplateWeeklyBattle(weekStart)
    assert.match(weekly, /战报/)
    assert.match(weekly, /SmokeE2E|auth|登录/i)

    console.log('smoke-e2e: ok (capture → assets → seal → daily → weekly)')
  } finally {
    closeDatabase()
    rmSync(dir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error('smoke-e2e: failed')
  console.error(err)
  process.exit(1)
})
