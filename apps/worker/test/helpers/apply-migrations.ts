/**
 * Applies the real migrations/0001-initial-schema.sql content.
 * Kept in sync via scripts/check-migrations.mjs (content hash) and test assert.
 * Workers test runtime cannot read Node fs, so SQL is embedded at build/test time.
 *
 * SOURCE OF TRUTH: ../../../../migrations/0001-initial-schema.sql
 * If you change the migration file, update this embed and re-run tests.
 */
export const INITIAL_MIGRATION_SQL = `
-- Foundation schema. No email subject/sender/body/recipients/raw payload storage.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  microsoft_user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, microsoft_user_id)
);

CREATE TABLE sessions (
  id_digest TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user_expiry
  ON sessions(user_id, expires_at);

CREATE TABLE microsoft_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_refresh_token TEXT NOT NULL,
  token_key_version INTEGER NOT NULL,
  granted_scopes TEXT NOT NULL,
  status TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE graph_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  client_state_digest TEXT NOT NULL,
  resource TEXT NOT NULL,
  change_type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL,
  last_renewed_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_graph_subscriptions_expiry
  ON graph_subscriptions(status, expires_at);

CREATE TABLE telegram_destinations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  chat_title TEXT,
  status TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notification_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  show_sender INTEGER NOT NULL DEFAULT 1 CHECK(show_sender IN (0,1)),
  show_subject INTEGER NOT NULL DEFAULT 1 CHECK(show_subject IN (0,1)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  updated_at TEXT NOT NULL
);

CREATE TABLE delivery_status (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);
`.trim();

export async function applyInitialMigration(db: D1Database): Promise<void> {
  // Enable FK for this connection when supported.
  try {
    await db.prepare("PRAGMA foreign_keys = ON").run();
  } catch {
    // Some D1 test pools ignore PRAGMA; continue.
  }

  const statements = INITIAL_MIGRATION_SQL.split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0 && !/^PRAGMA\b/i.test(s));

  for (const statement of statements) {
    try {
      await db.prepare(statement).run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/already exists/i.test(message)) throw err;
    }
  }
}
