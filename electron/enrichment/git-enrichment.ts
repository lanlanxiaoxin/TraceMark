import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getDb } from '../database'
import { getRepoPathForProject, listProjectSpaces } from '../project-spaces'

const execFileAsync = promisify(execFile)

export interface GitCommitSummary {
  hash: string
  message: string
}

export interface GitDiffSnapshot {
  project: string
  repoPath: string
  timestamp: number
  filesChanged: number
  insertions: number
  deletions: number
  files: string[]
  rawDiffStat: string
}

// In-memory cache for resolved repo paths (survives between captures)
const repoPathCache = new Map<string, string | null>()

function isGitIntegrationEnabled(): boolean {
  try {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'git_integration_enabled'").get() as
      | { value: string }
      | undefined
    return row?.value !== 'false'
  } catch {
    return true
  }
}

/** @deprecated 使用 resolveRepoPath（带缓存和 git 验证） */
export function guessRepoPathFromProject(projectName: string | null): string | null {
  if (!projectName?.trim()) return null
  const home = homedir()
  const candidates = [
    join(home, 'workspace', projectName),
    join(home, 'workspace_lanlan', projectName),
    join(home, 'projects', projectName),
    join(home, 'dev', projectName),
    join(home, 'code', projectName),
    join(home, 'Documents', projectName)
  ]
  for (const p of candidates) {
    if (existsSync(join(p, '.git'))) return p
  }
  return null
}

async function verifyRepoPath(candidate: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', candidate, 'rev-parse', '--show-toplevel'],
      { timeout: 5000, windowsHide: true }
    )
    const resolved = stdout.trim()
    return resolved || null
  } catch {
    return null
  }
}

export async function resolveRepoPathForProject(projectId: number): Promise<string | null> {
  const bound = getRepoPathForProject(projectId)
  if (bound) {
    const verified = await verifyRepoPath(bound)
    if (verified) return verified
  }
  const space = listProjectSpaces().find(s => s.id === projectId)
  if (space) return resolveRepoPath(space.name)
  return null
}

export async function resolveRepoPath(projectName: string | null): Promise<string | null> {
  if (!projectName?.trim()) return null
  if (repoPathCache.has(projectName)) return repoPathCache.get(projectName)!

  const spaces = listProjectSpaces()
  for (const space of spaces) {
    if (space.name.toLowerCase() === projectName.toLowerCase()) {
      const bound = getRepoPathForProject(space.id)
      if (bound) {
        const verified = await verifyRepoPath(bound)
        if (verified) {
          repoPathCache.set(projectName, verified)
          return verified
        }
      }
    }
  }

  const guessed = guessRepoPathFromProject(projectName)
  if (guessed) {
    const verified = await verifyRepoPath(guessed)
    if (verified) {
      repoPathCache.set(projectName, verified)
      return verified
    }
  }

  repoPathCache.set(projectName, null)
  return null
}

/** 解析 git diff --stat 输出的纯文本为结构化数据 */
function parseDiffStat(raw: string, project: string, repoPath: string): GitDiffSnapshot | null {
  const lines = raw.split('\n').filter(Boolean)
  if (lines.length === 0) return null

  const summaryLine = lines[lines.length - 1]
  const fileCount = summaryLine.match(/(\d+) files? changed/)
  const insertCount = summaryLine.match(/(\d+) insertions?\(\+\)/)
  const deleteCount = summaryLine.match(/(\d+) deletions?\(-\)/)

  const filesChanged = fileCount ? Number.parseInt(fileCount[1], 10) : 0
  const insertions = insertCount ? Number.parseInt(insertCount[1], 10) : 0
  const deletions = deleteCount ? Number.parseInt(deleteCount[1], 10) : 0

  const files = lines
    .filter(l => l.includes('|'))
    .map(l => {
      const pipe = l.indexOf('|')
      return l.substring(0, pipe).trim().replace(/^.*[/\\]/, '')
    })
    .filter(Boolean)

  return {
    project,
    repoPath,
    timestamp: Date.now(),
    filesChanged,
    insertions,
    deletions,
    files: [...new Set(files)],
    rawDiffStat: raw
  }
}

export async function captureGitDiffSnapshot(projectName: string): Promise<void> {
  if (!isGitIntegrationEnabled()) return

  const repoPath = await resolveRepoPath(projectName)
  if (!repoPath) return

  try {
    const [diffResult, cachedResult] = await Promise.all([
      execFileAsync('git', ['-C', repoPath, 'diff', '--stat'], { timeout: 5000, windowsHide: true }),
      execFileAsync('git', ['-C', repoPath, 'diff', '--cached', '--stat'], { timeout: 5000, windowsHide: true })
    ])

    const combined = [diffResult.stdout.trim(), cachedResult.stdout.trim()]
      .filter(Boolean)
      .join('\n')
    if (!combined) return

    const snapshot = parseDiffStat(combined, projectName, repoPath)
    if (!snapshot) return

    const db = getDb()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      `git_diff_snapshot:${projectName}:${snapshot.timestamp}`,
      JSON.stringify(snapshot)
    )
  } catch {
    // git diff 失败（非 git 仓库、无变更等）→ 静默忽略
  }
}

export function loadGitDiffSnapshots(project: string, sinceMs: number): GitDiffSnapshot[] {
  const db = getDb()
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'git_diff_snapshot:%'")
    .all() as { key: string; value: string }[]

  return rows
    .map(r => {
      try {
        return JSON.parse(r.value) as GitDiffSnapshot
      } catch {
        db.prepare('DELETE FROM settings WHERE key = ?').run(r.key)
        return null
      }
    })
    .filter((s): s is GitDiffSnapshot => s !== null && s.project === project && s.timestamp >= sinceMs)
    .sort((a, b) => a.timestamp - b.timestamp)
}

export function loadAllGitDiffSnapshots(sinceMs: number): Map<string, GitDiffSnapshot[]> {
  const db = getDb()
  const rows = db
    .prepare("SELECT value FROM settings WHERE key LIKE 'git_diff_snapshot:%'")
    .all() as { value: string }[]

  const grouped = new Map<string, GitDiffSnapshot[]>()
  for (const row of rows) {
    try {
      const s = JSON.parse(row.value) as GitDiffSnapshot
      if (s.timestamp >= sinceMs) {
        const list = grouped.get(s.project) ?? []
        list.push(s)
        grouped.set(s.project, list)
      }
    } catch {
      // skip malformed entries
    }
  }
  return grouped
}

export function cleanupExpiredDiffSnapshots(retentionDays: number = 7): void {
  const db = getDb()
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'git_diff_snapshot:%'")
    .all() as { key: string; value: string }[]

  for (const row of rows) {
    try {
      const snapshot = JSON.parse(row.value) as GitDiffSnapshot
      if (snapshot.timestamp < cutoff) {
        db.prepare('DELETE FROM settings WHERE key = ?').run(row.key)
      }
    } catch {
      db.prepare('DELETE FROM settings WHERE key = ?').run(row.key)
    }
  }
}

export async function queryGitCommitsSince(
  repoPath: string,
  sinceMs: number
): Promise<GitCommitSummary[]> {
  if (!isGitIntegrationEnabled()) return []
  if (!existsSync(join(repoPath, '.git'))) return []

  const sinceIso = new Date(sinceMs).toISOString()
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', repoPath, 'log', `--since=${sinceIso}`, '--oneline', '--all', '-n', '20'],
      { timeout: 8000, windowsHide: true }
    )
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const space = line.indexOf(' ')
        if (space < 0) return { hash: line.slice(0, 7), message: line }
        return { hash: line.slice(0, space), message: line.slice(space + 1) }
      })
  } catch {
    return []
  }
}

export async function collectGitCommitsForProjects(
  projects: string[],
  sinceMs: number
): Promise<Map<string, GitCommitSummary[]>> {
  const result = new Map<string, GitCommitSummary[]>()
  const seen = new Set<string>()

  for (const project of projects) {
    if (!project || seen.has(project)) continue
    seen.add(project)
    const repoPath = await resolveRepoPath(project)
    if (!repoPath) continue
    const commits = await queryGitCommitsSince(repoPath, sinceMs)
    if (commits.length > 0) result.set(project, commits)
  }

  return result
}
