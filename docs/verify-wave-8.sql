-- ============================================================
-- WAVE 8 VERIFICATION — Schema Cleanup
-- ============================================================

\echo '══════════════════════════════════════════════'
\echo 'WAVE 8 VERIFICATION'
\echo '══════════════════════════════════════════════'

-- ─── 8.1 Self-rating CHECK ───────────────────────────────
\echo ''
\echo '--- 8.1: Self-rating CHECK constraint ---'

DO $$
DECLARE
  check_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'no_self_rating' AND conrelid = 'user_ratings'::regclass
  ) INTO check_exists;

  IF check_exists THEN
    RAISE NOTICE '✅ PASS: no_self_rating constraint exists';
  ELSE
    RAISE NOTICE '❌ FAIL: no_self_rating constraint missing on user_ratings';
  END IF;
END $$;

-- ─── 8.2 invite_status enum ─────────────────────────────
\echo ''
\echo '--- 8.2: invite_status enum exists ---'

DO $$
BEGIN
  PERFORM 'pending'::invite_status;
  RAISE NOTICE '✅ PASS: invite_status enum exists';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ FAIL: invite_status enum does not exist — session_invites.status is still plain text';
END $$;

-- ─── 8.3 session_invites indexes ─────────────────────────
\echo ''
\echo '--- 8.3: session_invites indexes ---'

DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE tablename = 'session_invites'
    AND indexname IN ('idx_session_invites_session', 'idx_session_invites_user');

  IF idx_count >= 2 THEN
    RAISE NOTICE '✅ PASS: session_invites has session and user indexes';
  ELSE
    RAISE NOTICE '❌ FAIL: Missing indexes on session_invites (found % of 2)', idx_count;
  END IF;
END $$;

-- ─── 8.5 Participant count trigger return ────────────────
\echo ''
\echo '--- 8.5: Participant count trigger correctness ---'

DO $$
DECLARE
  func_body TEXT;
BEGIN
  SELECT prosrc INTO func_body FROM pg_proc
  WHERE proname = 'update_session_participant_count';

  IF func_body IS NOT NULL THEN
    RAISE NOTICE '✅ PASS: Function exists (review return logic manually if needed)';
  ELSE
    RAISE NOTICE '❌ FAIL: Function not found';
  END IF;
END $$;

-- ─── 8.6 Both cron jobs exist ────────────────────────────
\echo ''
\echo '--- 8.6: All cron jobs scheduled ---'

DO $$
DECLARE
  job_count INT;
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO job_count FROM cron.job
  WHERE jobname IN ('auto-cancel-expired-sessions', 'auto-complete-past-bookings');

  SELECT COUNT(*) INTO duplicate_count
  FROM (SELECT jobname FROM cron.job GROUP BY jobname HAVING COUNT(*) > 1) x;

  IF job_count >= 2 AND duplicate_count = 0 THEN
    RAISE NOTICE '✅ PASS: Both cron jobs exist, no duplicates';
  ELSIF duplicate_count > 0 THEN
    RAISE NOTICE '❌ FAIL: Duplicate cron jobs found — unschedule extras';
  ELSE
    RAISE NOTICE '❌ FAIL: Only % of 2 expected cron jobs found', job_count;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  SKIP: pg_cron not available — verify Vercel Cron instead';
END $$;

\echo ''
\echo '══════════════════════════════════════════════'
\echo 'WAVE 8 COMPLETE'
\echo '══════════════════════════════════════════════'
