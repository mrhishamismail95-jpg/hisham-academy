-- Self-hosted uploads (replaces the Anything-hosted upload service).
-- Files are small (<= 4 MB, images/PDF) and stored in Postgres so the app works
-- on any host without extra object storage. Safe to re-run.
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  data BYTEA NOT NULL,
  uploaded_by_role TEXT,
  uploaded_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
