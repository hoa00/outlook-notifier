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
