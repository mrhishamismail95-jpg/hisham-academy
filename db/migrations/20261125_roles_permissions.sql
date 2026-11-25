-- Flexible roles and permissions for academy staff.
ALTER TABLE academy_users DROP CONSTRAINT IF EXISTS academy_users_role_check;
ALTER TABLE academy_users ADD CONSTRAINT academy_users_role_check CHECK (role IN ('admin','supervisor','teacher','student','parent'));

CREATE TABLE IF NOT EXISTS academy_roles (
  id BIGSERIAL PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO academy_roles (role_key, name, permissions, is_system) VALUES
  ('admin', 'مدير النظام', '["users.view","users.manage","packages.manage","registrations.view","settings.manage","sessions.view","sessions.manage","payments.view","payments.manage","attendance.manage"]', TRUE),
  ('supervisor', 'مشرف أكاديمي', '["users.view","registrations.view","students.manage","teachers.view","sessions.view","sessions.manage","attendance.manage"]', TRUE),
  ('teacher', 'معلم', '["students.view","sessions.view","attendance.manage"]', TRUE),
  ('student', 'طالب', '["sessions.view"]', TRUE),
  ('parent', 'ولي أمر', '["sessions.view"]', TRUE)
ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name, permissions = EXCLUDED.permissions, updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_academy_users_role ON academy_users(role);
