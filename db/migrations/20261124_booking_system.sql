-- Hisham Academy: individual and group session booking
-- Idempotent migration. Review ID column types against the live Neon schema before production rollout.
CREATE TABLE IF NOT EXISTS bookable_sessions (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  session_type TEXT NOT NULL CHECK (session_type IN ('private', 'group')),
  max_seats INTEGER NOT NULL CHECK (max_seats > 0),
  seats_taken INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookable_sessions_time_valid CHECK (ends_at > starts_at),
  CONSTRAINT bookable_sessions_private_one_seat CHECK (session_type <> 'private' OR max_seats = 1),
  CONSTRAINT bookable_sessions_seats_ok CHECK (seats_taken <= max_seats)
);

CREATE INDEX IF NOT EXISTS idx_bookable_sessions_teacher ON bookable_sessions (teacher_id);
CREATE INDEX IF NOT EXISTS idx_bookable_sessions_starts ON bookable_sessions (starts_at);
CREATE INDEX IF NOT EXISTS idx_bookable_sessions_status ON bookable_sessions (status);

CREATE TABLE IF NOT EXISTS session_bookings (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES bookable_sessions(id) ON DELETE CASCADE,
  booked_by_student_id BIGINT,
  seats INTEGER NOT NULL DEFAULT 1 CHECK (seats > 0),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'payment_review', 'approved', 'rejected', 'cancelled', 'expired')),
  payment_method TEXT,
  payment_reference TEXT,
  payment_proof_url TEXT,
  payment_proof_file_id UUID,
  teacher_note TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_bookings_session ON session_bookings (session_id);
CREATE INDEX IF NOT EXISTS idx_session_bookings_status ON session_bookings (status);
CREATE INDEX IF NOT EXISTS idx_session_bookings_booked_by ON session_bookings (booked_by_student_id);

CREATE TABLE IF NOT EXISTS booking_students (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES session_bookings(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL,
  attendance_status TEXT DEFAULT 'unknown'
    CHECK (attendance_status IN ('unknown', 'present', 'absent', 'late', 'excused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_students_student ON booking_students (student_id);

-- Optional: teacher schedule lock helper (application uses advisory lock / serializable checks)
CREATE TABLE IF NOT EXISTS teacher_schedule_locks (
  teacher_id BIGINT PRIMARY KEY,
  locked_until TIMESTAMPTZ
);
