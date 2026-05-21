import { getDb } from './database'

export type ProjectRoleTemplate = 'developer' | 'pm' | 'implementation' | 'office'
export type ProjectAliasType = 'name' | 'repo' | 'browser' | 'document' | 'meeting' | 'chat'

export interface ProjectSpace {
  id: number
  name: string
  privacyAlias: string | null
  description: string | null
  roleTemplate: ProjectRoleTemplate | null
  createdAt: number
  updatedAt: number
}

export interface ProjectAlias {
  id: number
  projectId: number
  alias: string
  aliasType: ProjectAliasType
  value: string
  createdAt: number
}

interface ProjectSpaceRow {
  id: number
  name: string
  privacy_alias: string | null
  description: string | null
  role_template: string | null
  created_at: number
  updated_at: number
}

interface ProjectAliasRow {
  id: number
  project_id: number
  alias: string
  alias_type: string
  value: string
  created_at: number
}

function rowToProjectSpace(row: ProjectSpaceRow): ProjectSpace {
  return {
    id: row.id,
    name: row.name,
    privacyAlias: row.privacy_alias,
    description: row.description,
    roleTemplate: (row.role_template as ProjectRoleTemplate | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToAlias(row: ProjectAliasRow): ProjectAlias {
  return {
    id: row.id,
    projectId: row.project_id,
    alias: row.alias,
    aliasType: row.alias_type as ProjectAliasType,
    value: row.value,
    createdAt: row.created_at
  }
}

export interface CreateProjectSpaceInput {
  name: string
  privacyAlias?: string
  description?: string
  roleTemplate?: ProjectRoleTemplate
}

export interface UpdateProjectSpaceInput {
  name?: string
  privacyAlias?: string | null
  description?: string | null
  roleTemplate?: ProjectRoleTemplate | null
}

export function listProjectSpaces(): ProjectSpace[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM project_spaces ORDER BY updated_at DESC')
    .all() as ProjectSpaceRow[]
  return rows.map(rowToProjectSpace)
}

export function getProjectSpace(id: number): ProjectSpace | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM project_spaces WHERE id = ?').get(id) as
    | ProjectSpaceRow
    | undefined
  return row ? rowToProjectSpace(row) : null
}

export function createProjectSpace(input: CreateProjectSpaceInput): ProjectSpace {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(
      `INSERT INTO project_spaces (name, privacy_alias, description, role_template, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name.trim(),
      input.privacyAlias?.trim() ?? null,
      input.description?.trim() ?? null,
      input.roleTemplate ?? 'developer',
      now,
      now
    )
  return getProjectSpace(Number(result.lastInsertRowid))!
}

export function updateProjectSpace(id: number, patch: UpdateProjectSpaceInput): ProjectSpace | null {
  const existing = getProjectSpace(id)
  if (!existing) return null

  const db = getDb()
  const now = Date.now()
  db.prepare(
    `UPDATE project_spaces SET name = ?, privacy_alias = ?, description = ?, role_template = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    patch.name?.trim() ?? existing.name,
    patch.privacyAlias !== undefined ? patch.privacyAlias : existing.privacyAlias,
    patch.description !== undefined ? patch.description : existing.description,
    patch.roleTemplate !== undefined ? patch.roleTemplate : existing.roleTemplate,
    now,
    id
  )
  return getProjectSpace(id)
}

export function deleteProjectSpace(id: number): boolean {
  const db = getDb()
  const scopeId = String(id)

  const run = db.transaction(() => {
    db.prepare('DELETE FROM project_aliases WHERE project_id = ?').run(id)
    db.prepare('DELETE FROM work_assets WHERE project_id = ?').run(id)
    db.prepare('DELETE FROM session_summaries WHERE project_id = ?').run(id)
    db.prepare('DELETE FROM retrospectives WHERE project_id = ?').run(id)
    db.prepare(
      `DELETE FROM privacy_consents WHERE scope_type = 'project' AND scope_id = ?`
    ).run(scopeId)
    return db.prepare('DELETE FROM project_spaces WHERE id = ?').run(id)
  })

  return run().changes > 0
}

export function addProjectAlias(
  projectId: number,
  aliasType: ProjectAliasType,
  value: string,
  alias?: string
): ProjectAlias {
  const db = getDb()
  const now = Date.now()
  const label = alias?.trim() || value.trim()
  const result = db
    .prepare(
      `INSERT INTO project_aliases (project_id, alias, alias_type, value, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(projectId, label, aliasType, value.trim(), now)
  const row = db.prepare('SELECT * FROM project_aliases WHERE id = ?').get(result.lastInsertRowid) as
    ProjectAliasRow
  return rowToAlias(row)
}

export function listProjectAliases(projectId: number): ProjectAlias[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM project_aliases WHERE project_id = ? ORDER BY alias_type, id')
    .all(projectId) as ProjectAliasRow[]
  return rows.map(rowToAlias)
}

export function deleteProjectAlias(aliasId: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM project_aliases WHERE id = ?').run(aliasId)
  return result.changes > 0
}

export function replaceProjectAliases(
  projectId: number,
  aliases: Array<{ aliasType: ProjectAliasType; value: string; alias?: string }>
): ProjectAlias[] {
  const db = getDb()
  db.prepare('DELETE FROM project_aliases WHERE project_id = ?').run(projectId)
  for (const item of aliases) {
    if (!item.value.trim()) continue
    addProjectAlias(projectId, item.aliasType, item.value, item.alias)
  }
  return listProjectAliases(projectId)
}

/** Optional fields improve disambiguation when multiple projects overlap. */
export interface MatchProjectContext {
  category?: string | null
  parsedFile?: string | null
  processName?: string | null
  executablePath?: string | null
}

function normalizeMatchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

const ALIAS_TYPE_WEIGHT: Record<ProjectAliasType, number> = {
  repo: 120,
  document: 45,
  browser: 45,
  meeting: 28,
  chat: 28,
  name: 18
}

function scoreAliasHit(
  haystack: string,
  rawValue: string,
  rawLabel: string,
  aliasType: ProjectAliasType,
  category: string | null | undefined
): number {
  const value = normalizeMatchText(rawValue)
  const label = normalizeMatchText(rawLabel)
  if (value.length < 2 && label.length < 2) return 0

  let best = 0
  const tryHit = (needle: string, weight: number): void => {
    if (needle.length < 2) return
    if (haystack.includes(needle)) {
      const len = Math.min(needle.length, 240)
      best = Math.max(best, len * weight)
    }
  }

  const w = ALIAS_TYPE_WEIGHT[aliasType]
  let mult = 1
  if (aliasType === 'browser' && category === 'browser') mult = 1.15
  if (aliasType === 'document' && (category === 'docs' || category === 'code_editor')) mult = 1.12

  tryHit(value, w * mult)
  tryHit(label, w * 0.85 * mult)
  return best
}

/** Best-scoring project when several spaces match the same haystack (fixes first-wins bias). */
export function matchProjectId(
  parsedProject: string | null,
  windowTitle: string | null,
  sanitizedTitle: string | null,
  ctx?: MatchProjectContext
): number | null {
  const spaces = listProjectSpaces()
  if (spaces.length === 0) return null

  const parts = [parsedProject, windowTitle, sanitizedTitle, ctx?.parsedFile, ctx?.processName, ctx?.executablePath]
    .filter((x): x is string => Boolean(x && String(x).trim()))
  const haystack = normalizeMatchText(parts.join(' | '))
  if (!haystack) return null

  const category = ctx?.category ?? null
  let bestId: number | null = null
  let bestScore = 0

  for (const space of spaces) {
    let spaceScore = 0
    const nameNorm = normalizeMatchText(space.name)
    if (nameNorm.length >= 2 && haystack.includes(nameNorm)) {
      spaceScore = Math.max(spaceScore, nameNorm.length * ALIAS_TYPE_WEIGHT.name)
    }

    const aliases = listProjectAliases(space.id)
    for (const a of aliases) {
      spaceScore = Math.max(spaceScore, scoreAliasHit(haystack, a.value, a.alias, a.aliasType, category))
    }

    if (spaceScore > bestScore) {
      bestScore = spaceScore
      bestId = space.id
    } else if (spaceScore > 0 && spaceScore === bestScore && bestId !== null) {
      if (space.id < bestId) bestId = space.id
    }
  }

  return bestId
}

export function getRepoPathForProject(projectId: number): string | null {
  const aliases = listProjectAliases(projectId)
  const repo = aliases.find(a => a.aliasType === 'repo')
  return repo?.value ?? null
}
