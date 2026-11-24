-- Hisham Academy booking hardening (safe to re-run).
-- Once proof/reference is submitted, the seat remains reserved until the teacher reviews it.
UPDATE session_bookings
SET expires_at = NULL, updated_at = NOW()
WHERE status = 'payment_review' AND expires_at IS NOT NULL;

-- Expiry worker only releases unpaid holds. Payment-review bookings are not auto-released.
CREATE INDEX IF NOT EXISTS idx_session_bookings_unpaid_expiry
ON session_bookings (expires_at)
WHERE status = 'pending_payment' AND expires_at IS NOT NULL;
