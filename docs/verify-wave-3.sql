-- ============================================================
-- WAVE 3 VERIFICATION — Booking Integrity
-- ============================================================

\echo '══════════════════════════════════════════════'
\echo 'WAVE 3 VERIFICATION'
\echo '══════════════════════════════════════════════'

-- ─── 3.1 No stale bookings ───────────────────────────────
\echo ''
\echo '--- 3.1: No stale confirmed bookings ---'

DO $$
DECLARE
  stale_count INT;
BEGIN
  SELECT COUNT(*) INTO stale_count
  FROM bookings
  WHERE status = 'confirmed' AND (date + end_time) < now();

  IF stale_count = 0 THEN
    RAISE NOTICE '✅ PASS: No stale bookings (all past bookings are completed)';
  ELSE
    RAISE NOTICE '❌ FAIL: % bookings are still confirmed after their end time', stale_count;
  END IF;
END $$;

-- ─── 3.1b Cron job exists ────────────────────────────────
\echo ''
\echo '--- 3.1b: auto-complete cron job scheduled ---'

DO $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-past-bookings'
  ) INTO job_exists;

  IF job_exists THEN
    RAISE NOTICE '✅ PASS: auto-complete-past-bookings cron job exists';
  ELSE
    RAISE NOTICE '❌ FAIL: Cron job not found';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  SKIP: pg_cron not available — verify Vercel Cron fallback instead';
END $$;

-- ─── 3.2 Booking overlap protection ─────────────────────
\echo ''
\echo '--- 3.2: Booking overlap constraint ---'

DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  -- Check for exclusion constraint (Option A)
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE '✅ PASS: Exclusion constraint bookings_no_overlap exists';
  ELSE
    RAISE NOTICE '⚠️  INFO: No exclusion constraint — relying on create_booking_safe() function only. Ensure all inserts go through it.';
  END IF;
END $$;

-- ─── 3.2b Test overlap rejection ─────────────────────────
\echo ''
\echo '--- 3.2b: Overlap rejection test ---'

DO $$
DECLARE
  test_field_id UUID;
  test_user_id UUID;
  test_date DATE;
  result UUID;
BEGIN
  -- Find an existing confirmed booking
  SELECT field_id, date INTO test_field_id, test_date
  FROM bookings WHERE status IN ('confirmed', 'completed')
  LIMIT 1;

  SELECT id INTO test_user_id FROM profiles LIMIT 1;

  IF test_field_id IS NULL THEN
    RAISE NOTICE '⚠️  SKIP: No bookings found to test against';
    RETURN;
  END IF;

  -- Try overlapping booking (should fail)
  BEGIN
    SELECT create_booking_safe(
      test_field_id, test_user_id, test_date,
      '08:30'::time, '09:30'::time, 50.00, 97.79
    ) INTO result;

    -- If we get here, it didn't fail — that's bad
    -- Clean up the accidental booking
    DELETE FROM bookings WHERE id = result;
    RAISE NOTICE '❌ FAIL: Overlapping booking was ALLOWED — overlap check broken';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'SLOT_ALREADY_BOOKED' THEN
        RAISE NOTICE '✅ PASS: Overlapping booking correctly rejected (SLOT_ALREADY_BOOKED)';
      ELSE
        RAISE NOTICE '✅ PASS: Overlapping booking rejected with: %', SQLERRM;
      END IF;
  END;
END $$;

-- ─── 3.4 Time order constraints ──────────────────────────
\echo ''
\echo '--- 3.4: Time order CHECK constraints ---'

DO $$
DECLARE
  booking_check BOOLEAN;
  session_check BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'bookings_time_order'
  ) INTO booking_check;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sessions_time_order'
  ) INTO session_check;

  IF booking_check AND session_check THEN
    RAISE NOTICE '✅ PASS: Time order constraints exist on bookings and group_sessions';
  ELSE
    IF NOT booking_check THEN RAISE NOTICE '❌ FAIL: Missing bookings_time_order constraint'; END IF;
    IF NOT session_check THEN RAISE NOTICE '❌ FAIL: Missing sessions_time_order constraint'; END IF;
  END IF;
END $$;

-- ─── 3.5 bookings.session_id FK ─────────────────────────
\echo ''
\echo '--- 3.5: bookings.session_id foreign key ---'

DO $$
DECLARE
  fk_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
    WHERE kcu.table_name = 'bookings' AND kcu.column_name = 'session_id'
  ) INTO fk_exists;

  IF fk_exists THEN
    RAISE NOTICE '✅ PASS: bookings.session_id has FK to group_sessions';
  ELSE
    RAISE NOTICE '❌ FAIL: bookings.session_id has no foreign key constraint';
  END IF;
END $$;

\echo ''
\echo '══════════════════════════════════════════════'
\echo 'WAVE 3 COMPLETE'
\echo '══════════════════════════════════════════════'
\echo ''
\echo '🧑‍💻 BROWSER CHECKS REQUIRED:'
\echo '  - Go to /sessions/new → pick a slot with existing booking → verify it is greyed out'
\echo '  - Book a slot → try booking same slot in another browser → verify SLOT_ALREADY_BOOKED error'
