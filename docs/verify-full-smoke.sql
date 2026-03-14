-- ============================================================
-- FULL SMOKE TEST — Run after all 8 waves
-- Tests data integrity across the entire system
-- ============================================================

\echo '══════════════════════════════════════════════'
\echo 'FULL SYSTEM SMOKE TEST'
\echo '══════════════════════════════════════════════'

-- 1. No stale bookings
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed' AND (date + end_time) < now()) = 0 THEN
    RAISE NOTICE '✅ 1/12 No stale bookings';
  ELSE RAISE NOTICE '❌ 1/12 Stale bookings exist'; END IF;
END $$;

-- 2. No expired unprocessed drafts
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM group_sessions WHERE is_confirmed = false AND is_cancelled = false AND confirmation_deadline < now()) = 0 THEN
    RAISE NOTICE '✅ 2/12 No unprocessed expired drafts';
  ELSE RAISE NOTICE '❌ 2/12 Expired drafts not cancelled'; END IF;
END $$;

-- 3. Participant counts match reality
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM (
    SELECT gs.id, gs.current_participants,
           (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = gs.id AND sp.status = 'confirmed') AS actual
    FROM group_sessions gs
    WHERE gs.is_cancelled = false
  ) x WHERE x.current_participants != x.actual) = 0 THEN
    RAISE NOTICE '✅ 3/12 Participant counts are accurate';
  ELSE RAISE NOTICE '❌ 3/12 Participant counts out of sync'; END IF;
END $$;

-- 4. No self-ratings
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM user_ratings WHERE rater_id = rated_id) = 0 THEN
    RAISE NOTICE '✅ 4/12 No self-ratings';
  ELSE RAISE NOTICE '❌ 4/12 Self-ratings found'; END IF;
END $$;

-- 5. Rankings consistency
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM user_sport_rankings WHERE total_ratings_received > 0 AND total_sessions_played = 0) = 0 THEN
    RAISE NOTICE '✅ 5/12 Rankings data consistent';
  ELSE RAISE NOTICE '❌ 5/12 Rankings have ratings without sessions'; END IF;
END $$;

-- 6. No overlapping confirmed bookings
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM bookings b1 JOIN bookings b2
    ON b1.field_id = b2.field_id AND b1.date = b2.date AND b1.id < b2.id
    AND b1.start_time < b2.end_time AND b1.end_time > b2.start_time
    AND b1.status NOT IN ('cancelled') AND b2.status NOT IN ('cancelled')
  ) = 0 THEN
    RAISE NOTICE '✅ 6/12 No overlapping bookings';
  ELSE RAISE NOTICE '❌ 6/12 OVERLAPPING BOOKINGS FOUND — critical data integrity issue'; END IF;
END $$;

-- 7. All confirmed sessions have bookings
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM group_sessions WHERE is_confirmed = true AND booking_id IS NULL AND is_cancelled = false) = 0 THEN
    RAISE NOTICE '✅ 7/12 All confirmed sessions have booking_id';
  ELSE RAISE NOTICE '❌ 7/12 Confirmed sessions without bookings'; END IF;
END $$;

-- 8. No bookings with invalid time ranges
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM bookings WHERE end_time <= start_time) = 0 THEN
    RAISE NOTICE '✅ 8/12 No invalid time ranges in bookings';
  ELSE RAISE NOTICE '❌ 8/12 Bookings with end_time <= start_time found'; END IF;
END $$;

-- 9. All functions have search_path set
DO $$ 
DECLARE bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM pg_proc
  WHERE proname IN (
    'handle_new_user','is_super_admin','is_club_admin','is_club_member',
    'is_session_participant','create_booking_safe','cancel_draft_sessions_on_booking',
    'auto_cancel_expired_sessions','update_session_participant_count','update_sport_ranking'
  ) AND prosecdef = true AND (proconfig IS NULL OR NOT proconfig @> ARRAY['search_path=public']);

  IF bad_count = 0 THEN
    RAISE NOTICE '✅ 9/12 All security definer functions have search_path';
  ELSE RAISE NOTICE '❌ 9/12 % functions missing search_path', bad_count; END IF;
END $$;

-- 10. All required RLS policies exist
DO $$
DECLARE policy_count INT;
BEGIN
  SELECT COUNT(DISTINCT tablename) INTO policy_count FROM pg_policies
  WHERE policyname ILIKE '%super admin%'
  AND tablename IN ('group_sessions','session_invites','session_participants','user_ratings','user_rating_details');

  IF policy_count = 5 THEN
    RAISE NOTICE '✅ 10/12 All super admin RLS policies present';
  ELSE RAISE NOTICE '❌ 10/12 Only % of 5 tables have super admin policies', policy_count; END IF;
END $$;

-- 11. Updated_at triggers exist
DO $$
DECLARE trigger_count INT;
BEGIN
  SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE trigger_name = 'set_updated_at';
  IF trigger_count >= 8 THEN
    RAISE NOTICE '✅ 11/12 All updated_at triggers present';
  ELSE RAISE NOTICE '❌ 11/12 Only % of 8 updated_at triggers found', trigger_count; END IF;
END $$;

-- 12. Cron jobs scheduled
DO $$
DECLARE job_count INT;
BEGIN
  SELECT COUNT(*) INTO job_count FROM cron.job
  WHERE jobname IN ('auto-cancel-expired-sessions', 'auto-complete-past-bookings');
  IF job_count >= 2 THEN
    RAISE NOTICE '✅ 12/12 Both cron jobs scheduled';
  ELSE RAISE NOTICE '❌ 12/12 Only % of 2 cron jobs found', job_count; END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  12/12 pg_cron not available — verify Vercel Cron fallback';
END $$;

\echo ''
\echo '══════════════════════════════════════════════'
\echo 'SMOKE TEST COMPLETE'
\echo '══════════════════════════════════════════════'
\echo ''
\echo '🧑‍💻 REMAINING MANUAL BROWSER CHECKS:'
\echo '  1. Incognito → / → counts > 0'
\echo '  2. Incognito → club schedule → booked slots visible'
\echo '  3. Register new user → book a slot → success'
\echo '  4. Double-book same slot → error'
\echo '  5. Create draft session → warning banner shown'
\echo '  6. Confirm session → Active status'
\echo '  7. Request to join → organizer approves → count increments'
\echo '  8. Mark complete → rate player → ranking updates'
\echo '  9. Invite link → accept → auto-confirmed'
\echo '  10. Sign out → lands on landing page'
