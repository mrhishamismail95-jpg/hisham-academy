-- Public registrations and dynamic academy packages.
CREATE TABLE IF NOT EXISTS academy_packages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sessions_count INTEGER NOT NULL DEFAULT 4 CHECK (sessions_count > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'SAR',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_packages_public ON academy_packages(is_active, sort_order, id);

CREATE TABLE IF NOT EXISTS registrations (
  id BIGSERIAL PRIMARY KEY,
  registration_code TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL CHECK (request_type IN ('student','parent','teacher')),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  grade TEXT,
  subject TEXT,
  package_id BIGINT REFERENCES academy_packages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','accepted','rejected','converted')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registrations_status_date ON registrations(status, created_at DESC);

INSERT INTO academy_packages (name, description, sessions_count, price, currency, is_featured, sort_order)
SELECT 'الباقة الأساسية', 'للبداية والمتابعة', 4, 450, 'SAR', FALSE, 1
WHERE NOT EXISTS (SELECT 1 FROM academy_packages);
INSERT INTO academy_packages (name, description, sessions_count, price, currency, is_featured, sort_order)
SELECT 'الباقة القياسية', 'الأكثر اختياراً', 8, 800, 'SAR', TRUE, 2
WHERE (SELECT COUNT(*) FROM academy_packages) = 1;
INSERT INTO academy_packages (name, description, sessions_count, price, currency, is_featured, sort_order)
SELECT 'الباقة المكثفة', 'تقدم أسرع واهتمام أكبر', 12, 1100, 'SAR', FALSE, 3
WHERE (SELECT COUNT(*) FROM academy_packages) = 2;
