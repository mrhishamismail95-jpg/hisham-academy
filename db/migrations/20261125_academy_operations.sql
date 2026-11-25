-- Core academy operations.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS academy_sessions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT,
  teacher_id BIGINT REFERENCES academy_users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_sessions_starts ON academy_sessions(starts_at);

CREATE TABLE IF NOT EXISTS academy_bookings (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES academy_sessions(id) ON DELETE CASCADE,
  student_id BIGINT REFERENCES academy_users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','waitlist')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

CREATE TABLE IF NOT EXISTS academy_payments (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES academy_users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending','refunded','failed')),
  reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_payments_paid ON academy_payments(paid_at);

CREATE TABLE IF NOT EXISTS academy_attendance (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES academy_sessions(id) ON DELETE CASCADE,
  student_id BIGINT REFERENCES academy_users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_academy_attendance_marked ON academy_attendance(marked_at);
