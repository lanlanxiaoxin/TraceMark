import { getDb } from './database'

export type ConsentScopeType = 'global' | 'project' | 'app'

export interface PrivacyConsent {
  id: number
  scopeType: ConsentScopeType
  scopeId: string | null
  capability: string
  enabled: boolean
  updatedAt: number
}

interface PrivacyConsentRow {
  id: number
  scope_type: string
  scope_id: string | null
  capability: string
  enabled: number
  updated_at: number
}

function rowToConsent(row: PrivacyConsentRow): PrivacyConsent {
  return {
    id: row.id,
    scopeType: row.scope_type as ConsentScopeType,
    scopeId: row.scope_id,
    capability: row.capability,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at
  }
}

export function getPrivacyConsent(
  scopeType: ConsentScopeType,
  scopeId: string | null,
  capability: string
): PrivacyConsent | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT * FROM privacy_consents
       WHERE scope_type = ? AND (scope_id IS ? OR scope_id = ?) AND capability = ?`
    )
    .get(scopeType, scopeId, scopeId, capability) as PrivacyConsentRow | undefined
  return row ? rowToConsent(row) : null
}

export function setPrivacyConsent(
  scopeType: ConsentScopeType,
  scopeId: string | null,
  capability: string,
  enabled: boolean
): PrivacyConsent {
  const db = getDb()
  const now = Date.now()
  const existing = getPrivacyConsent(scopeType, scopeId, capability)

  if (existing) {
    db.prepare('UPDATE privacy_consents SET enabled = ?, updated_at = ? WHERE id = ?').run(
      enabled ? 1 : 0,
      now,
      existing.id
    )
    return { ...existing, enabled, updatedAt: now }
  }

  const result = db
    .prepare(
      `INSERT INTO privacy_consents (scope_type, scope_id, capability, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(scopeType, scopeId, capability, enabled ? 1 : 0, now)

  const row = db.prepare('SELECT * FROM privacy_consents WHERE id = ?').get(result.lastInsertRowid) as
    PrivacyConsentRow
  return rowToConsent(row)
}

export function listPrivacyConsents(
  scopeType?: ConsentScopeType,
  scopeId?: string | null
): PrivacyConsent[] {
  const db = getDb()
  let sql = 'SELECT * FROM privacy_consents'
  const params: unknown[] = []

  if (scopeType !== undefined) {
    sql += ' WHERE scope_type = ?'
    params.push(scopeType)
    if (scopeId !== undefined) {
      sql += ' AND (scope_id IS ? OR scope_id = ?)'
      params.push(scopeId, scopeId)
    }
  }
  sql += ' ORDER BY scope_type, capability'

  const rows = db.prepare(sql).all(...params) as PrivacyConsentRow[]
  return rows.map(rowToConsent)
}
