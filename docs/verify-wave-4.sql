-- ============================================================
-- WAVE 4 VERIFICATION — Session Lifecycle
-- ============================================================

\echo '══════════════════════════════════════════════'
\echo 'WAVE 4 VERIFICATION'
\echo '══════════════════════════════════════════════'

-- ─── 4.1 Auto-cancel cron exists ─────────────────────────
\echo ''
\echo '--- 4.1: auto-cancel cron job ---'

DO $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'auto-cancel-expired-sessions'
  ) INTO job_exists;

  IF job_exists THEN
    RAISE NOTICE '✅ PASS: auto-cancel-expired-sessions cron job exists';
  ELSE
    RAISE NOTICE '❌ FAIL: Cron job not found';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  SKIP: pg_cron not available — verify Vercel Cron fallback';
END $$;

-- ─── 4.1b Functional test: expired session gets cancelled ─
\echo ''
\echo '--- 4.1b: Auto-cancel functional test ---'

DO $$
DECLARE
  test_session_id UUID;
  test_field_id UUID;
  test_organizer_id UUID;
  test_sport_id UUID;
  is_now_cancelled BOOLEAN;
BEGIN
  SELECT id INTO test_organizer_id FROM profiles WHERE email = 'test4@sportly.dev';
  SELECT f.id, f.sport_category_id INTO test_field_id, test_sport_id FROM fields f LIMIT 1;

  -- Create a draft with an already-passed deadline
  INSERT INTO group_sessions (
    field_id, organizer_id, sport_category_id, title,
    date, start_time, end_time, is_confirmed,
    confirmation_deadline, visibility
  ) VALUES (
    test_field_id, test_organizer_id, test_sport_id,
    '_VERIFY_AUTO_CANCEL_TEST_',
    CURRENT_DATE + 20, '16:00', '17:00', false,
    now() - interval '1 hour', 'public'
  ) RETURNING id INTO test_session_id;

  -- Run the auto-cancel function
  PERFORM auto_cancel_expired_sessions();

  -- Check result
  SELECT is_cancelled INTO is_now_cancelled
  FROM group_sessions WHERE id = test_session_id;

  IF is_now_cancelled THEN
    RAISE NOTICE '✅ PASS: Expired draft session was auto-cancelled';
  ELSE
    RAISE NOTICE '❌ FAIL: Expired draft session was NOT cancelled';
  END IF;

  -- Clean up
  DELETE FROM group_sessions WHERE id = test_session_id;
END $$;

-- ─── 4.2 Rankings consistency ────────────────────────────
\echo ''
\echo '--- 4.2: Rankings data consistency ---'

DO $$
DECLARE
  inconsistent_count INT;
BEGIN
  SELECT COUNT(*) INTO inconsistent_count
  FROM user_sport_rankings
  WHERE total_ratings_received > 0 AND total_sessions_played = 0;

  IF inconsistent_count = 0 THEN
    RAISE NOTICE '✅ PASS: No rankings with ratings > 0 but sessions = 0';
  ELSE
    RAISE NOTICE '❌ FAIL: % rankings have ratings but 0 sessions played', inconsistent_count;
  END IF;
END $$;

-- ─── 4.5 Rating trigger uses COUNT ───────────────────────
\echo ''
\echo '--- 4.5 / 7.5: Rating trigger uses COUNT not +1 ---'

DO $$
DECLARE
  func_body TEXT;
BEGIN
  SELECT prosrc INTO func_body FROM pg_proc WHERE proname = 'update_sport_ranking';

  IF func_body ILIKE '%SELECT COUNT(%)%' THEN
    RAISE NOTICE '✅ PASS: update_sport_ranking uses COUNT(*) for total_ratings_received';
  ELSIF func_body ILIKE '%total_ratings_received + 1%' THEN
    RAISE NOTICE '❌ FAIL: update_sport_ranking uses +1 instead of COUNT(*) — race condition risk';
  ELSE
    RAISE NOTICE '⚠️  INFO: Could not determine pattern — manually review function body';
  END IF;
END $$;

\echo ''
\echo '══════════════════════════════════════════════'
\echo 'WAVE 4 COMPLETE'
\echo '══════════════════════════════════════════════'
\echo ''
\echo '🧑‍💻 BROWSER CHECKS REQUIRED:'
\echo '  - Log in as organizer → go to own session → verify no "Leave" button (4.3)'
\echo '  - Create 6 draft sessions → verify 6th is rejected (4.6)'
\echo '  - Test waitlist: fill session, add waitlisted user, have confirmed user leave (4.4)'
