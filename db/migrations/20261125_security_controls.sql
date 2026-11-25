-- Custom roles, audit trail and TOTP 2FA support.
ALTER TABLE academy_roles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE academy_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE academy_users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE academy_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE academy_users ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT;

CREATE TABLE IF NOT EXISTS academy_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES academy_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_audit_created ON academy_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_audit_actor ON academy_audit_logs(actor_user_id);
