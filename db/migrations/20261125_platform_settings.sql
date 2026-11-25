-- Platform-wide settings managed from the dashboard.
CREATE TABLE IF NOT EXISTS academy_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_by BIGINT REFERENCES academy_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO academy_settings (setting_key, setting_value) VALUES
  ('academyName', '"هشام أكاديمي"'::jsonb),
  ('supportPhone', '"05 0000 0000"'::jsonb),
  ('whatsapp', '"966500000000"'::jsonb),
  ('supportEmail', '"support@example.com"'::jsonb),
  ('currency', '"SAR"'::jsonb),
  ('timezone', '"Asia/Riyadh"'::jsonb),
  ('registrationEnabled', 'true'::jsonb),
  ('maintenanceMode', 'false'::jsonb),
  ('monthlyRevenueGoal', '55000'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
