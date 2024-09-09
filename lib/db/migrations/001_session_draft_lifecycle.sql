-- ============================================================
-- Migration 001: Session Draft Lifecycle
-- Adds draft session lifecycle, request-to-join flow, range overlap
-- check, and auto-cancellation triggers.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. ENUM CHANGES ──────────────────────────────────────

-- Add 'requested' status for session participants (request-to-join flow)
ALTER TYPE session_participant_status ADD VALUE IF NOT EXISTS 'requested' BEFORE 'confirmed';

-- ─── 2. TABLE CHANGES ─────────────────────────────────────

-- Add draft lifecycle columns to group_sessions
ALTER TABLE group_sessions
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Change bookings default status from 'pending' to 'confirmed'
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'confirmed';

-- Update any existing bookings that are 'pending' to 'confirmed' (data migration)
UPDATE bookings SET status = 'confirmed' WHERE status = 'pending';

-- For existing group_sessions that already have a booking_id, mark them as confirmed
UPDATE group_sessions
SET is_confirmed = true
WHERE booking_id IS NOT NULL
  AND is_cancelled = false;

-- For existing group_sessions without booking_id, compute a deadline
UPDATE group_sessions
SET confirmation_deadline = (date + start_time) - INTERVAL '2 hours'
WHERE booking_id IS NULL
  AND is_cancelled = false
  AND confirmation_deadline IS NULL;

-- ─── 3. NEW INDEXES ───────────────────────────────────────

-- Partial index for finding unconfirmed, non-cancelled sessions (used by pg_cron)
CREATE INDEX IF NOT EXISTS idx_sessions_confirmed
  ON group_sessions(is_confirmed)
  WHERE is_confirmed = false AND is_cancelled = false;

-- Partial index for deadline-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_deadline
  ON group_sessions(confirmation_deadline)
  WHERE is_confirmed = false AND is_cancelled = false;

-- Composite index for participant lookups by status
CREATE INDEX IF NOT EXISTS idx_session_participants_status
  ON session_participants(session_id, status);

-- ─── 4. UPDATED FUNCTIONS ─────────────────────────────────

-- Rewrite create_booking_safe with:
--   1. Time range overlap check (not exact start_time match)
--   2. p_session_id parameter for bidirectional linking
--   3. Always inserts with status = 'confirmed'
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_field_id UUID,
  p_user_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_price_eur DECIMAL,
  p_price_local DECIMAL,
  p_session_id UUID DEFAULT NULL,
  p_booked_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Lock the field row to serialise concurrent bookings
  PERFORM id FROM fields WHERE id = p_field_id FOR UPDATE;

  -- Time range overlap check
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE field_id = p_field_id
      AND date = p_date
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION 'SLOT_ALREADY_BOOKED';
  END IF;

  INSERT INTO bookings (
    field_id, user_id, date, start_time, end_time,
    status, total_price_eur, total_price_local,
    session_id, booked_by, notes
  ) VALUES (
    p_field_id, p_user_id, p_date, p_start_time, p_end_time,
    'confirmed', p_price_eur, p_price_local,
    p_session_id, p_booked_by, p_notes
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. NEW TRIGGERS ──────────────────────────────────────

-- When a regular booking (non-session) is confirmed, auto-cancel
-- all overlapping draft sessions on the same field+date+time range
CREATE OR REPLACE FUNCTION cancel_draft_sessions_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND NEW.session_id IS NULL THEN
    UPDATE group_sessions
    SET is_cancelled = true,
        cancelled_reason = 'slot_taken',
        updated_at = now()
    WHERE field_id = NEW.field_id
      AND date = NEW.date
      AND start_time < NEW.end_time
      AND end_time > NEW.start_time
      AND is_confirmed = false
      AND is_cancelled = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS on_booking_cancel_draft_sessions ON bookings;

CREATE TRIGGER on_booking_cancel_draft_sessions
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION cancel_draft_sessions_on_booking();

-- ─── 6. PG_CRON FUNCTION ──────────────────────────────────

-- Cancels unconfirmed sessions whose confirmation_deadline has passed
CREATE OR REPLACE FUNCTION auto_cancel_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE group_sessions
  SET is_cancelled = true,
      cancelled_reason = 'deadline_expired',
      updated_at = now()
  WHERE is_confirmed = false
    AND is_cancelled = false
    AND confirmation_deadline IS NOT NULL
    AND confirmation_deadline < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job (requires pg_cron extension enabled in Supabase)
-- Runs every 15 minutes
SELECT cron.schedule(
  'auto-cancel-expired-sessions',
  '*/15 * * * *',
  $$ SELECT auto_cancel_expired_sessions(); $$
);

-- ─── 7. VERIFICATION QUERIES ──────────────────────────────
-- Run these after the migration to verify everything applied correctly:

-- Check enum values:
-- SELECT enum_range(NULL::session_participant_status);
-- Expected: {invited,requested,confirmed,declined,waitlisted}

-- Check new columns exist:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'group_sessions'
--   AND column_name IN ('is_confirmed', 'confirmation_deadline', 'cancelled_reason');

-- Check booking default:
-- SELECT column_default FROM information_schema.columns
-- WHERE table_name = 'bookings' AND column_name = 'status';
-- Expected: 'confirmed'::booking_status

-- Check triggers:
-- SELECT trigger_name FROM information_schema.triggers
-- WHERE event_object_table = 'bookings' AND trigger_name = 'on_booking_cancel_draft_sessions';

-- Check cron job:
-- SELECT * FROM cron.job WHERE jobname = 'auto-cancel-expired-sessions';
