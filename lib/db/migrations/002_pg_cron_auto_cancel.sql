-- ═══════════════════════════════════════════════════════════════════
-- Migration 002: pg_cron auto-cancel for expired draft sessions
-- ═══════════════════════════════════════════════════════════════════
-- 
-- PREREQUISITES:
--   1. Enable pg_cron extension in Supabase Dashboard → Database → Extensions
--   2. Run this script in the Supabase SQL Editor
--
-- WHAT THIS DOES:
--   - Creates/replaces the auto_cancel_expired_sessions() function
--   - Schedules a pg_cron job to run it every 15 minutes
--   - Unconfirmed draft sessions whose confirmation_deadline has passed
--     will be automatically cancelled with cancelled_reason = 'deadline_expired'
--
-- IDEMPOTENT: Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create the function (idempotent via CREATE OR REPLACE)
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

-- 2. Remove existing schedule if it exists (idempotent)
SELECT cron.unschedule('auto-cancel-expired-sessions')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-cancel-expired-sessions'
);

-- 3. Schedule the job to run every 15 minutes
SELECT cron.schedule(
  'auto-cancel-expired-sessions',
  '*/15 * * * *',
  $$ SELECT auto_cancel_expired_sessions(); $$
);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- Check that the cron job was created:
-- SELECT * FROM cron.job WHERE jobname = 'auto-cancel-expired-sessions';

-- Check recent execution history:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-cancel-expired-sessions')
-- ORDER BY start_time DESC LIMIT 5;

-- Test manually (cancels any currently expired drafts):
-- SELECT auto_cancel_expired_sessions();

-- Verify cancelled sessions:
-- SELECT id, title, is_cancelled, cancelled_reason, confirmation_deadline
-- FROM group_sessions
-- WHERE cancelled_reason = 'deadline_expired'
-- ORDER BY updated_at DESC LIMIT 10;
