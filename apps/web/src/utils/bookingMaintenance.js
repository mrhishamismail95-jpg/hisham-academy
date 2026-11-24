import sql from "@/app/api/utils/sql";

// Release seats held by unpaid bookings after the 30-minute checkout window.
export async function releaseExpiredBookingSeats() {
  await sql`
    WITH expired AS (
      UPDATE session_bookings
      SET status = 'cancelled', updated_at = NOW()
      WHERE status = 'pending_payment'
        AND expires_at IS NOT NULL AND expires_at <= NOW()
      RETURNING session_id, seat_count
    ), totals AS (
      SELECT session_id, SUM(seat_count)::INTEGER AS seats
      FROM expired GROUP BY session_id
    )
    UPDATE bookable_sessions bs
    SET reserved_seats = GREATEST(0, bs.reserved_seats - totals.seats),
        status = CASE WHEN bs.status = 'full' THEN 'published' ELSE bs.status END,
        updated_at = NOW()
    FROM totals WHERE bs.id = totals.session_id`;
}
