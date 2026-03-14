-- ═══════════════════════════════════════════════════════════════════
-- Migration 003: Replace narrow booking index with GiST exclusion constraint
-- ═══════════════════════════════════════════════════════════════════
--
-- PREREQUISITES:
--   1. Run this script in the Supabase SQL Editor
--
-- WHAT THIS DOES:
--   - Enables the btree_gist extension (required for exclusion constraints
--     that mix equality and range operators)
--   - Drops the old idx_bookings_no_overlap unique index which only prevents
--     exact (field_id, date, start_time) duplicates
--   - Adds a proper GiST exclusion constraint that prevents any overlapping
--     time ranges for the same field+date among non-cancelled bookings
--
-- WHY:
--   The old index only blocked two bookings with the exact same start_time.
--   A booking at 10:00-11:00 and another at 10:30-11:30 would BOTH pass.
--   The new constraint catches any range overlap: start_time < end_time2
--   AND end_time > start_time2.
--
-- FALLBACK:
--   If btree_gist is unavailable on your Supabase plan, skip this migration.
--   The create_booking_safe() function already does an overlap check with
--   row-level locking, so overlaps are still prevented at the application
--   layer. This constraint is the database-level safety net.
--
-- IDEMPOTENT: Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════════

-- 1. Enable btree_gist (required for exclusion constraints with = and &&)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Drop the old narrow unique index
DROP INDEX IF EXISTS idx_bookings_no_overlap;

-- 3. Drop the constraint if it already exists (idempotent)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;

-- 4. Add proper range overlap exclusion constraint
-- This prevents any two non-cancelled bookings on the same field+date
-- from having overlapping time ranges.
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    field_id WITH =,
    date WITH =,
    tsrange(
      ('2000-01-01'::date + start_time)::timestamp,
      ('2000-01-01'::date + end_time)::timestamp
    ) WITH &&
  ) WHERE (status != 'cancelled');

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check the constraint exists:
-- SELECT conname, contype FROM pg_constraint
-- WHERE conrelid = 'bookings'::regclass AND conname = 'bookings_no_overlap';

-- Test: this should SUCCEED (non-overlapping)
-- INSERT INTO bookings (field_id, user_id, date, start_time, end_time, status)
-- VALUES ('...', '...', '2025-01-01', '10:00', '11:00', 'confirmed');
-- INSERT INTO bookings (field_id, user_id, date, start_time, end_time, status)
-- VALUES ('...', '...', '2025-01-01', '11:00', '12:00', 'confirmed');

-- Test: this should FAIL with exclusion violation (overlapping)
-- INSERT INTO bookings (field_id, user_id, date, start_time, end_time, status)
-- VALUES ('...', '...', '2025-01-01', '10:30', '11:30', 'confirmed');
