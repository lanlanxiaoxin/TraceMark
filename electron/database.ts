import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'workflow-ai.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  createTables()
}

function createTables(): void {
  if (!db) throw new Error('Database not initialized')

  db.exec(`
    CREATE TABLE IF NOT EXISTS file_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      action TEXT CHECK(action IN ('create','modify','rename','delete')),
      timestamp INTEGER NOT NULL,
      file_type TEXT DEFAULT 'other',
      git_added INTEGER DEFAULT 0,
      git_removed INTEGER DEFAULT 0,
      is_important INTEGER DEFAULT 0,
      user_note TEXT,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_file_logs_timestamp
      ON file_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_file_logs_path_time
      ON file_logs(file_path, timestamp);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_name TEXT NOT NULL,
      window_title TEXT,
      executable_path TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      is_important INTEGER DEFAULT 0,
      user_note TEXT,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_started
      ON activity_logs(started_at);

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('daily','weekly')),
      date_start INTEGER,
      date_end INTEGER,
      content TEXT,
      status TEXT CHECK(status IN ('draft','confirmed','exported')) DEFAULT 'draft',
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  migrateActivityLogsColumns()
  migrateLegacyAiSettings()
  migratePro50Tables()
  migrateLocalMetricsTable()

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  insertSetting.run('process_monitoring_enabled', 'true')
  insertSetting.run('poll_interval_seconds', '5')
  insertSetting.run('exclude_processes', '[]')
  insertSetting.run('exclude_title_keywords', '[]')
  insertSetting.run('sanitization_rules', '[]')
  insertSetting.run('git_integration_enabled', 'true')
  insertSetting.run('ai_provider_type', 'preset')
  insertSetting.run('ai_preset', 'deepseek-v4-flash')
  insertSetting.run('ai_custom_base_url', '')
  insertSetting.run('ai_custom_model', '')
  insertSetting.run('ai_model', 'deepseek-v4-flash')
  insertSetting.run('api_key', '')
  insertSetting.run('offline_mode', 'false')
  insertSetting.run('git_diff_retention_days', '7')
  insertSetting.run('daily_reminder_enabled', 'true')
  insertSetting.run('friday_reminder_enabled', 'true')
  insertSetting.run('daily_reminder_time', '18:00')
  insertSetting.run('friday_reminder_time', '16:00')
  insertSetting.run('daily_narrative_use_ai', 'false')
}

function migrateActivityLogsColumns(): void {
  if (!db) return

  const columns = db
    .prepare("SELECT name FROM pragma_table_info('activity_logs')")
    .all() as { name: string }[]
  const names = new Set(columns.map(c => c.name))

  const addColumn = (sql: string): void => {
    if (!db) return
    db.exec(sql)
  }

  if (!names.has('category')) {
    addColumn("ALTER TABLE activity_logs ADD COLUMN category TEXT")
  }
  if (!names.has('parsed_project')) {
    addColumn('ALTER TABLE activity_logs ADD COLUMN parsed_project TEXT')
  }
  if (!names.has('parsed_file')) {
    addColumn('ALTER TABLE activity_logs ADD COLUMN parsed_file TEXT')
  }
  if (!names.has('sanitized_title')) {
    addColumn('ALTER TABLE activity_logs ADD COLUMN sanitized_title TEXT')
  }
  if (!names.has('enrichment_source')) {
    addColumn('ALTER TABLE activity_logs ADD COLUMN enrichment_source TEXT')
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(parsed_project);
  `)
}

function migratePro50Tables(): void {
  if (!db) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      privacy_alias TEXT,
      description TEXT,
      role_template TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_spaces_name ON project_spaces(name);

    CREATE TABLE IF NOT EXISTS project_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES project_spaces(id),
      alias TEXT NOT NULL,
      alias_type TEXT CHECK(alias_type IN ('name','repo','browser','document','meeting','chat')) NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_aliases_project ON project_aliases(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_aliases_value ON project_aliases(value);

    CREATE TABLE IF NOT EXISTS work_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES project_spaces(id),
      title TEXT NOT NULL,
      asset_kind TEXT CHECK(asset_kind IN ('outcome','process','evidence')) NOT NULL,
      asset_type TEXT NOT NULL,
      description TEXT,
      impact TEXT,
      confidence TEXT CHECK(confidence IN ('high','medium','low')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('suggested','confirmed','ignored','private')) DEFAULT 'suggested',
      privacy_level TEXT CHECK(privacy_level IN ('local','structured_cloud','enhanced_cloud')) DEFAULT 'structured_cloud',
      started_at INTEGER,
      ended_at INTEGER,
      evidence_json TEXT,
      tags_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_work_assets_project ON work_assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_work_assets_status ON work_assets(status);
    CREATE INDEX IF NOT EXISTS idx_work_assets_time ON work_assets(started_at, ended_at);

    CREATE TABLE IF NOT EXISTS session_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES project_spaces(id),
      activity_log_id INTEGER,
      process_name TEXT,
      source_type TEXT CHECK(source_type IN ('git','browser','document','meeting','chat','manual')) NOT NULL,
      summary TEXT NOT NULL,
      source_level TEXT CHECK(source_level IN ('basic','safe','enhanced')) NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project_id);

    CREATE TABLE IF NOT EXISTS privacy_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope_type TEXT CHECK(scope_type IN ('global','project','app')) NOT NULL,
      scope_id TEXT,
      capability TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_privacy_consents_scope ON privacy_consents(scope_type, scope_id);

    CREATE TABLE IF NOT EXISTS retrospectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES project_spaces(id),
      type TEXT CHECK(type IN ('weekly','project_phase')) NOT NULL,
      date_start INTEGER NOT NULL,
      date_end INTEGER NOT NULL,
      content TEXT NOT NULL,
      source_asset_ids_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}

function migrateLocalMetricsTable(): void {
  if (!db) return
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      payload_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_metrics_created ON local_metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_local_metrics_name ON local_metrics(name);
  `)
}

function migrateLegacyAiSettings(): void {
  if (!db) return

  const hasProviderType = db
    .prepare("SELECT 1 AS ok FROM settings WHERE key = 'ai_provider_type'")
    .get() as { ok: number } | undefined

  if (hasProviderType) return

  const legacy = db
    .prepare("SELECT value FROM settings WHERE key = 'ai_model'")
    .get() as { value: string } | undefined

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_provider_type', 'preset')").run()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_preset', ?)").run(
    legacy?.value ?? 'deepseek-v4-flash'
  )
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_custom_base_url', '')").run()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_custom_model', '')").run()
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
