-- ============================================================
-- WAVE 1 VERIFICATION — DB Foundation
-- Run this after completing all Wave 1 fixes.
-- Each check prints PASS or FAIL.
-- ============================================================

\echo '══════════════════════════════════════════════'
\echo 'WAVE 1 VERIFICATION'
\echo '══════════════════════════════════════════════'

-- ─── 1.1 search_path on all functions ─────────────────────
\echo ''
\echo '--- 1.1: search_path fixed on SECURITY DEFINER functions ---'

DO $$
DECLARE
  fn TEXT;
  fn_config TEXT[];
  missing_fns TEXT[] := '{}';
  all_fns TEXT[] := ARRAY[
    'handle_new_user', 'is_super_admin', 'is_club_admin', 'is_club_member',
    'is_session_participant', 'create_booking_safe', 'cancel_draft_sessions_on_booking',
    'auto_cancel_expired_sessions', 'update_session_participant_count', 'update_sport_ranking'
  ];
BEGIN
  FOREACH fn IN ARRAY all_fns LOOP
    SELECT proconfig INTO fn_config
    FROM pg_proc WHERE proname = fn AND prosecdef = true;

    IF fn_config IS NULL OR NOT (fn_config @> ARRAY['search_path=public']) THEN
      missing_fns := missing_fns || fn;
    END IF;
  END LOOP;

  IF array_length(missing_fns, 1) IS NULL OR array_length(missing_fns, 1) = 0 THEN
    RAISE NOTICE '✅ PASS: All 10 functions have search_path=public';
  ELSE
    RAISE NOTICE '❌ FAIL: Missing search_path on: %', array_to_string(missing_fns, ', ');
  END IF;
END $$;

-- ─── 1.2 updated_at triggers ──────────────────────────────
\echo ''
\echo '--- 1.2: updated_at triggers exist ---'

DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'bookings', 'clubs', 'field_booking_settings', 'fields',
    'group_sessions', 'locations', 'profiles', 'user_sport_rankings'
  ];
  tbl TEXT;
  missing TEXT[] := '{}';
  trigger_exists BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY expected_tables LOOP
    SELECT EXISTS(
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'set_updated_at' AND event_object_table = tbl
    ) INTO trigger_exists;

    IF NOT trigger_exists THEN
      missing := missing || tbl;
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NULL OR array_length(missing, 1) = 0 THEN
    RAISE NOTICE '✅ PASS: All 8 updated_at triggers exist';
  ELSE
    RAISE NOTICE '❌ FAIL: Missing triggers on: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- ─── 1.3 Super admin RLS on 5 tables ─────────────────────
\echo ''
\echo '--- 1.3: Super admin RLS policies ---'

DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'group_sessions', 'session_invites', 'session_participants',
    'user_ratings', 'user_rating_details'
  ];
  tbl TEXT;
  missing TEXT[] := '{}';
  policy_exists BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY required_tables LOOP
    SELECT EXISTS(
      SELECT 1 FROM pg_policies
      WHERE tablename = tbl AND policyname ILIKE '%super admin%'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      missing := missing || tbl;
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NULL OR array_length(missing, 1) = 0 THEN
    RAISE NOTICE '✅ PASS: All 5 tables have super admin RLS';
  ELSE
    RAISE NOTICE '❌ FAIL: Missing super admin policy on: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- ─── 1.4 Anonymous RLS for public data ────────────────────
\echo ''
\echo '--- 1.4: Anonymous/public read RLS policies ---'

DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'sport_categories', 'clubs', 'locations', 'fields',
    'location_schedules', 'field_attributes', 'field_booking_settings',
    'group_sessions', 'user_sport_rankings', 'bookings'
  ];
  tbl TEXT;
  missing TEXT[] := '{}';
  policy_exists BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY required_tables LOOP
    SELECT EXISTS(
      SELECT 1 FROM pg_policies
      WHERE tablename = tbl AND policyname ILIKE '%public%' AND cmd = 'SELECT'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      missing := missing || tbl;
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NULL OR array_length(missing, 1) = 0 THEN
    RAISE NOTICE '✅ PASS: All 10 tables have public read policies';
  ELSE
    RAISE NOTICE '❌ FAIL: Missing public read policy on: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- ─── 1.5 Minor RLS policies ──────────────────────────────
\echo ''
\echo '--- 1.5: Minor RLS policies ---'

DO $$
DECLARE
  missing TEXT[] := '{}';
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile') THEN
    missing := missing || 'profiles INSERT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'user_sport_rankings' AND policyname ILIKE '%super admin%can manage%') THEN
    missing := missing || 'user_sport_rankings super admin write';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'user_ratings' AND policyname ILIKE '%rater%delete%') THEN
    missing := missing || 'user_ratings self-delete';
  END IF;

  IF array_length(missing, 1) IS NULL OR array_length(missing, 1) = 0 THEN
    RAISE NOTICE '✅ PASS: All minor RLS policies exist';
  ELSE
    RAISE NOTICE '❌ FAIL: Missing: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- ─── 1.7 Draft cancel trigger fires on INSERT + UPDATE ───
\echo ''
\echo '--- 1.7: cancel_draft trigger on INSERT + UPDATE ---'

DO $$
DECLARE
  trigger_count INT;
BEGIN
  SELECT COUNT(DISTINCT event_manipulation)
  INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name = 'on_booking_cancel_draft_sessions';

  IF trigger_count >= 2 THEN
    RAISE NOTICE '✅ PASS: Trigger fires on both INSERT and UPDATE';
  ELSIF trigger_count = 1 THEN
    RAISE NOTICE '❌ FAIL: Trigger only fires on INSERT (need UPDATE too)';
  ELSE
    RAISE NOTICE '❌ FAIL: Trigger not found at all';
  END IF;
END $$;

\echo ''
\echo '══════════════════════════════════════════════'
\echo 'WAVE 1 COMPLETE — Check results above'
\echo '══════════════════════════════════════════════'
\echo ''
\echo '🧑‍💻 MANUAL CHECK REQUIRED:'
\echo '  1.6: Go to Supabase Dashboard → Auth → Settings → Security'
\echo '       Verify "Leaked Password Protection" is ON'
\echo ''
\echo '🧑‍💻 BROWSER CHECK REQUIRED:'
\echo '  Open incognito → visit landing page → verify counts > 0'
\echo '  Visit club schedule → verify some slots show as booked'
