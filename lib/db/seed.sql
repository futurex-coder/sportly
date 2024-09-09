-- ============================================================
-- SPORTLY — Comprehensive Seed Data
-- Run after supabase-schema.sql (or migration 001) is applied.
--
-- Creates:
--   6 test users (via Supabase Auth + profiles)
--   2 clubs with members
--   3 locations with schedules
--   6 fields with booking settings & attributes
--   Bookings in various states
--   Group sessions (draft, active, completed, cancelled, expired)
--   Participants (confirmed, requested, invited, waitlisted)
--   Ratings
--
-- Test credentials:
--   test1@sportly.dev / Test1234!  → super_admin
--   test2@sportly.dev / Test1234!  → club_admin (Arena Rakovski)
--   test3@sportly.dev / Test1234!  → staff (Arena Rakovski)
--   test4@sportly.dev / Test1234!  → client (regular user)
--   test5@sportly.dev / Test1234!  → client (regular user)
--   test6@sportly.dev / Test1234!  → trainer (Sportify Center)
-- ============================================================

-- ─── 0. STABLE UUIDs ──────────────────────────────────────
-- Using deterministic UUIDs so FKs reference correctly.

-- Users
-- u1 = 00000000-0000-0000-0000-000000000001  (super_admin)
-- u2 = 00000000-0000-0000-0000-000000000002  (club_admin)
-- u3 = 00000000-0000-0000-0000-000000000003  (staff)
-- u4 = 00000000-0000-0000-0000-000000000004  (client)
-- u5 = 00000000-0000-0000-0000-000000000005  (client)
-- u6 = 00000000-0000-0000-0000-000000000006  (trainer)

-- Sport categories (from main schema seed — already inserted)
-- We'll reference them by querying on slug.

-- Clubs
-- club1 = 00000000-0000-0000-0001-000000000001  (Arena Rakovski)
-- club2 = 00000000-0000-0000-0001-000000000002  (Sportify Center)

-- Locations
-- loc1 = 00000000-0000-0000-0002-000000000001  (Arena Rakovski Main)
-- loc2 = 00000000-0000-0000-0002-000000000002  (Arena Rakovski South)
-- loc3 = 00000000-0000-0000-0002-000000000003  (Sportify Plovdiv)

-- Fields
-- f1 = 00000000-0000-0000-0003-000000000001  (Pitch 1 @ loc1, football)
-- f2 = 00000000-0000-0000-0003-000000000002  (Pitch 2 @ loc1, football)
-- f3 = 00000000-0000-0000-0003-000000000003  (Padel Court 1 @ loc1, padel)
-- f4 = 00000000-0000-0000-0003-000000000004  (Tennis Court @ loc2, tennis)
-- f5 = 00000000-0000-0000-0003-000000000005  (Football Pitch @ loc3, football)
-- f6 = 00000000-0000-0000-0003-000000000006  (Basketball Court @ loc3, basketball)

-- Bookings
-- b1..b6

-- Sessions
-- s1..s5

-- ─── 1. AUTH USERS ────────────────────────────────────────
-- Insert into auth.users with pre-hashed password for 'Test1234!'
-- Valid bcrypt hash generated via: require('bcryptjs').hashSync('Test1234!', 10)
-- GoTrue requires all string columns to be '' not NULL (email_change, phone, etc.)
-- The handle_new_user trigger will auto-create profiles.

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, confirmation_token, recovery_token,
  is_super_admin, raw_app_meta_data,
  email_change, email_change_token_new, email_change_token_current,
  email_change_confirm_status, phone_change, phone_change_token
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'test1@sportly.dev',
  '$2a$10$T7lYbrbO/Tol7Yc3WFpea.yruJP/BL.tIAuZzdv5nuDtJiCPgq8km',
  now(), now(), now(),
  '{"full_name": "Admin Super"}',
  '', '', false,
  '{"provider": "email", "providers": ["email"]}',
  '', '', '', 0, '', ''
),
(
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'test2@sportly.dev',
  '$2a$10$T7lYbrbO/Tol7Yc3WFpea.yruJP/BL.tIAuZzdv5nuDtJiCPgq8km',
  now(), now(), now(),
  '{"full_name": "Ivan Petrov"}',
  '', '', false,
  '{"provider": "email", "providers": ["email"]}',
  '', '', '', 0, '', ''
),
(
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'test3@sportly.dev',
  '$2a$10$T7lYbrbO/Tol7Yc3WFpea.yruJP/BL.tIAuZzdv5nuDtJiCPgq8km',
  now(), now(), now(),
  '{"full_name": "Maria Ivanova"}',
  '', '', false,
  '{"provider": "email", "providers": ["email"]}',
  '', '', '', 0, '', ''
),
(
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'test4@sportly.dev',
  '$2a$10$T7lYbrbO/Tol7Yc3WFpea.yruJP/BL.tIAuZzdv5nuDtJiCPgq8km',
  now(), now(), now(),
  '{"full_name": "Georgi Dimitrov"}',
  '', '', false,
  '{"provider": "email", "providers": ["email"]}',
  '', '', '', 0, '', ''
),
(
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'test5@sportly.dev',
  '$2a$10$T7lYbrbO/Tol7Yc3WFpea.yruJP/BL.tIAuZzdv5nuDtJiCPgq8km',
  now(), now(), now(),
  '{"full_name": "Elena Todorova"}',
  '', '', false,
  '{"provider": "email", "providers": ["email"]}',
  '', '', '', 0, '', ''
),
(
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'test6@sportly.dev',
  '$2a$10$T7lYbrbO/Tol7Yc3WFpea.yruJP/BL.tIAuZzdv5nuDtJiCPgq8km',
  now(), now(), now(),
  '{"full_name": "Nikolay Trainer"}',
  '', '', false,
  '{"provider": "email", "providers": ["email"]}',
  '', '', '', 0, '', ''
)
ON CONFLICT (id) DO NOTHING;

-- Also insert identities for each user (required for Supabase Auth login)
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'test1@sportly.dev', 'email', '{"sub":"00000000-0000-0000-0000-000000000001","email":"test1@sportly.dev","email_verified":true}', now(), now(), now()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'test2@sportly.dev', 'email', '{"sub":"00000000-0000-0000-0000-000000000002","email":"test2@sportly.dev","email_verified":true}', now(), now(), now()),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'test3@sportly.dev', 'email', '{"sub":"00000000-0000-0000-0000-000000000003","email":"test3@sportly.dev","email_verified":true}', now(), now(), now()),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'test4@sportly.dev', 'email', '{"sub":"00000000-0000-0000-0000-000000000004","email":"test4@sportly.dev","email_verified":true}', now(), now(), now()),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'test5@sportly.dev', 'email', '{"sub":"00000000-0000-0000-0000-000000000005","email":"test5@sportly.dev","email_verified":true}', now(), now(), now()),
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', 'test6@sportly.dev', 'email', '{"sub":"00000000-0000-0000-0000-000000000006","email":"test6@sportly.dev","email_verified":true}', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─── 2. UPDATE PROFILES (set roles, cities) ───────────────
-- The handle_new_user trigger created profiles with role='client'.
-- Now promote users to their intended roles.

UPDATE profiles SET role = 'super_admin', city = 'Sofia',   phone = '+359888000001' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE profiles SET role = 'club_admin',  city = 'Sofia',   phone = '+359888000002' WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE profiles SET role = 'staff',       city = 'Sofia',   phone = '+359888000003' WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE profiles SET role = 'client',      city = 'Sofia',   phone = '+359888000004' WHERE id = '00000000-0000-0000-0000-000000000004';
UPDATE profiles SET role = 'client',      city = 'Plovdiv', phone = '+359888000005' WHERE id = '00000000-0000-0000-0000-000000000005';
UPDATE profiles SET role = 'trainer',     city = 'Plovdiv', phone = '+359888000006' WHERE id = '00000000-0000-0000-0000-000000000006';

-- ─── 3. CLUBS ─────────────────────────────────────────────

INSERT INTO clubs (id, name, slug, description, email, phone, city) VALUES
(
  '00000000-0000-0000-0001-000000000001',
  'Arena Rakovski',
  'arena-rakovski',
  'Premier sports complex in Sofia with football, padel, and tennis facilities.',
  'info@arena-rakovski.bg',
  '+359 2 123 4567',
  'Sofia'
),
(
  '00000000-0000-0000-0001-000000000002',
  'Sportify Center',
  'sportify-center',
  'Modern sports hub in Plovdiv offering football, basketball, and fitness.',
  'info@sportify.bg',
  '+359 32 987 6543',
  'Plovdiv'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. CLUB MEMBERS ─────────────────────────────────────

INSERT INTO club_members (club_id, user_id, role) VALUES
-- Arena Rakovski team
('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002', 'club_admin'),
('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000003', 'staff'),
-- Sportify Center team
('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000006', 'trainer')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- ─── 5. LOCATIONS ─────────────────────────────────────────

INSERT INTO locations (id, club_id, name, slug, address, city, phone, description) VALUES
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'Arena Rakovski Main',
  'main',
  'ul. Balsha 18',
  'Sofia',
  '+359 2 123 4567',
  'Main campus with 2 football pitches and a padel court.'
),
(
  '00000000-0000-0000-0002-000000000002',
  '00000000-0000-0000-0001-000000000001',
  'Arena Rakovski South',
  'south',
  'bul. Bulgaria 102',
  'Sofia',
  '+359 2 123 4568',
  'Southern branch with tennis courts.'
),
(
  '00000000-0000-0000-0002-000000000003',
  '00000000-0000-0000-0001-000000000002',
  'Sportify Plovdiv',
  'plovdiv',
  'ul. Maritsa 45',
  'Plovdiv',
  '+359 32 987 6543',
  'Full-service sports complex with football and basketball.'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 6. LOCATION SCHEDULES ───────────────────────────────
-- All locations: Mon-Fri 07:00-22:00, Sat-Sun 08:00-20:00

DO $$
DECLARE
  loc_ids UUID[] := ARRAY[
    '00000000-0000-0000-0002-000000000001'::UUID,
    '00000000-0000-0000-0002-000000000002'::UUID,
    '00000000-0000-0000-0002-000000000003'::UUID
  ];
  loc UUID;
  d TEXT;
BEGIN
  FOREACH loc IN ARRAY loc_ids LOOP
    FOREACH d IN ARRAY ARRAY['monday','tuesday','wednesday','thursday','friday'] LOOP
      INSERT INTO location_schedules (location_id, day_of_week, open_time, close_time, is_closed)
      VALUES (loc, d::day_of_week, '07:00', '22:00', false)
      ON CONFLICT (location_id, day_of_week) DO NOTHING;
    END LOOP;
    FOREACH d IN ARRAY ARRAY['saturday','sunday'] LOOP
      INSERT INTO location_schedules (location_id, day_of_week, open_time, close_time, is_closed)
      VALUES (loc, d::day_of_week, '08:00', '20:00', false)
      ON CONFLICT (location_id, day_of_week) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ─── 7. FIELDS ────────────────────────────────────────────

INSERT INTO fields (id, location_id, sport_category_id, name, slug, description, sort_order) VALUES
(
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0002-000000000001',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  'Pitch 1',
  'pitch-1',
  'Full-size artificial turf football pitch with floodlights.',
  1
),
(
  '00000000-0000-0000-0003-000000000002',
  '00000000-0000-0000-0002-000000000001',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  'Pitch 2',
  'pitch-2',
  'Smaller 5-a-side pitch, artificial turf.',
  2
),
(
  '00000000-0000-0000-0003-000000000003',
  '00000000-0000-0000-0002-000000000001',
  (SELECT id FROM sport_categories WHERE slug = 'padel'),
  'Padel Court 1',
  'padel-1',
  'Indoor padel court with glass walls.',
  3
),
(
  '00000000-0000-0000-0003-000000000004',
  '00000000-0000-0000-0002-000000000002',
  (SELECT id FROM sport_categories WHERE slug = 'tennis'),
  'Tennis Court A',
  'tennis-a',
  'Outdoor hard court with lighting.',
  1
),
(
  '00000000-0000-0000-0003-000000000005',
  '00000000-0000-0000-0002-000000000003',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  'Main Pitch',
  'main-pitch',
  'Natural grass football pitch.',
  1
),
(
  '00000000-0000-0000-0003-000000000006',
  '00000000-0000-0000-0002-000000000003',
  (SELECT id FROM sport_categories WHERE slug = 'basketball'),
  'Basketball Court',
  'basketball-1',
  'Indoor basketball court, hardwood floor.',
  2
)
ON CONFLICT (id) DO NOTHING;

-- ─── 8. FIELD ATTRIBUTES ─────────────────────────────────

INSERT INTO field_attributes (field_id, attribute_key, attribute_value) VALUES
-- Pitch 1
('00000000-0000-0000-0003-000000000001', 'surface', 'artificial_turf'),
('00000000-0000-0000-0003-000000000001', 'environment', 'outdoor'),
('00000000-0000-0000-0003-000000000001', 'lighting', 'floodlights'),
('00000000-0000-0000-0003-000000000001', 'size', '11v11'),
-- Pitch 2
('00000000-0000-0000-0003-000000000002', 'surface', 'artificial_turf'),
('00000000-0000-0000-0003-000000000002', 'environment', 'outdoor'),
('00000000-0000-0000-0003-000000000002', 'lighting', 'floodlights'),
('00000000-0000-0000-0003-000000000002', 'size', '5v5'),
-- Padel Court 1
('00000000-0000-0000-0003-000000000003', 'surface', 'artificial_turf'),
('00000000-0000-0000-0003-000000000003', 'environment', 'indoor'),
('00000000-0000-0000-0003-000000000003', 'lighting', 'led'),
-- Tennis Court A
('00000000-0000-0000-0003-000000000004', 'surface', 'hard_court'),
('00000000-0000-0000-0003-000000000004', 'environment', 'outdoor'),
('00000000-0000-0000-0003-000000000004', 'lighting', 'floodlights'),
-- Main Pitch (Plovdiv)
('00000000-0000-0000-0003-000000000005', 'surface', 'natural_grass'),
('00000000-0000-0000-0003-000000000005', 'environment', 'outdoor'),
('00000000-0000-0000-0003-000000000005', 'lighting', 'floodlights'),
('00000000-0000-0000-0003-000000000005', 'size', '7v7'),
-- Basketball Court (Plovdiv)
('00000000-0000-0000-0003-000000000006', 'surface', 'hardwood'),
('00000000-0000-0000-0003-000000000006', 'environment', 'indoor'),
('00000000-0000-0000-0003-000000000006', 'lighting', 'led')
ON CONFLICT (field_id, attribute_key) DO NOTHING;

-- ─── 9. FIELD BOOKING SETTINGS ───────────────────────────

INSERT INTO field_booking_settings (
  field_id, slot_duration_minutes, buffer_minutes,
  price_per_slot_eur, price_per_slot_local, currency_local,
  min_booking_notice_hours, max_booking_advance_days,
  cancellation_policy_hours, auto_confirm
) VALUES
('00000000-0000-0000-0003-000000000001', 60, 0, 50.00, 97.79, 'BGN', 2, 30, 24, true),
('00000000-0000-0000-0003-000000000002', 60, 0, 35.00, 68.45, 'BGN', 1, 30, 12, true),
('00000000-0000-0000-0003-000000000003', 90, 15, 40.00, 78.23, 'BGN', 2, 14, 24, true),
('00000000-0000-0000-0003-000000000004', 60, 0, 30.00, 58.67, 'BGN', 1, 30, 12, true),
('00000000-0000-0000-0003-000000000005', 60, 0, 25.00, 48.90, 'BGN', 1, 30, 12, true),
('00000000-0000-0000-0003-000000000006', 60, 0, 20.00, 39.12, 'BGN', 1, 30, 6, true)
ON CONFLICT (field_id) DO NOTHING;

-- ─── 10. BOOKINGS ─────────────────────────────────────────
-- Mix of confirmed bookings on various fields/dates.
-- Using CURRENT_DATE + offsets for relative dates.

INSERT INTO bookings (id, field_id, user_id, date, start_time, end_time, status, total_price_eur, total_price_local, notes) VALUES
-- Confirmed booking by user4 on Pitch 1, tomorrow 08:00-09:00
(
  '00000000-0000-0000-0004-000000000001',
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0000-000000000004',
  CURRENT_DATE + 1,
  '08:00', '09:00',
  'confirmed', 50.00, 97.79,
  'Morning training'
),
-- Confirmed booking by user5 on Pitch 1, tomorrow 10:00-11:00
(
  '00000000-0000-0000-0004-000000000002',
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0000-000000000005',
  CURRENT_DATE + 1,
  '10:00', '11:00',
  'confirmed', 50.00, 97.79,
  NULL
),
-- Confirmed booking by user4 on Padel Court, day after tomorrow 14:00-15:30
(
  '00000000-0000-0000-0004-000000000003',
  '00000000-0000-0000-0003-000000000003',
  '00000000-0000-0000-0000-000000000004',
  CURRENT_DATE + 2,
  '14:00', '15:30',
  'confirmed', 40.00, 78.23,
  'Padel match with friends'
),
-- Past confirmed booking (yesterday) on Pitch 2 — for completed session
(
  '00000000-0000-0000-0004-000000000004',
  '00000000-0000-0000-0003-000000000002',
  '00000000-0000-0000-0000-000000000004',
  CURRENT_DATE - 1,
  '18:00', '19:00',
  'confirmed', 35.00, 68.45,
  NULL
),
-- Cancelled booking
(
  '00000000-0000-0000-0004-000000000005',
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0000-000000000005',
  CURRENT_DATE + 3,
  '09:00', '10:00',
  'cancelled', 50.00, 97.79,
  'Cancelled by user'
),
-- Past confirmed booking (3 days ago) on Main Pitch Plovdiv — for completed session
(
  '00000000-0000-0000-0004-000000000006',
  '00000000-0000-0000-0003-000000000005',
  '00000000-0000-0000-0000-000000000005',
  CURRENT_DATE - 3,
  '16:00', '17:00',
  'confirmed', 25.00, 48.90,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- ─── 11. GROUP SESSIONS ──────────────────────────────────
-- Various states: draft, active (confirmed), completed, cancelled, expired

INSERT INTO group_sessions (
  id, field_id, booking_id, organizer_id, sport_category_id,
  title, description, visibility, date, start_time, end_time,
  max_participants, current_participants,
  price_per_person_eur, price_per_person_local,
  skill_level_min, skill_level_max,
  is_confirmed, confirmation_deadline, cancelled_reason, is_cancelled, completed_at
) VALUES
-- S1: DRAFT public session on Pitch 1, day after tomorrow 14:00 (no booking yet)
(
  '00000000-0000-0000-0005-000000000001',
  '00000000-0000-0000-0003-000000000001',
  NULL,
  '00000000-0000-0000-0000-000000000004',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  'Friday Pickup Football',
  'Casual 5v5 game, all levels welcome!',
  'public',
  CURRENT_DATE + 2,
  '14:00', '15:00',
  10, 1,
  5.00, 9.78,
  0, 5,
  false,
  (CURRENT_DATE + 2 + TIME '14:00' - INTERVAL '2 hours')::TIMESTAMPTZ,
  NULL, false, NULL
),
-- S2: ACTIVE (confirmed) public session on Pitch 2, tomorrow 12:00 (has booking)
(
  '00000000-0000-0000-0005-000000000002',
  '00000000-0000-0000-0003-000000000002',
  NULL,
  '00000000-0000-0000-0000-000000000005',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  'Morning Football League',
  'Competitive 5-a-side mini league match.',
  'public',
  CURRENT_DATE + 1,
  '12:00', '13:00',
  10, 3,
  0, 0,
  2.0, 5.0,
  true,
  (CURRENT_DATE + 1 + TIME '12:00' - INTERVAL '2 hours')::TIMESTAMPTZ,
  NULL, false, NULL
),
-- S3: COMPLETED session (yesterday on Pitch 2) — linked to booking b4
(
  '00000000-0000-0000-0005-000000000003',
  '00000000-0000-0000-0003-000000000002',
  '00000000-0000-0000-0004-000000000004',
  '00000000-0000-0000-0000-000000000004',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  'Evening Kickabout',
  'Friendly session, had a great time!',
  'public',
  CURRENT_DATE - 1,
  '18:00', '19:00',
  8, 4,
  0, 0,
  0, 5,
  true,
  (CURRENT_DATE - 1 + TIME '18:00' - INTERVAL '2 hours')::TIMESTAMPTZ,
  NULL, false,
  (CURRENT_DATE - 1 + TIME '19:30')::TIMESTAMPTZ
),
-- S4: CANCELLED (manual) session
(
  '00000000-0000-0000-0005-000000000004',
  '00000000-0000-0000-0003-000000000004',
  NULL,
  '00000000-0000-0000-0000-000000000005',
  (SELECT id FROM sport_categories WHERE slug = 'tennis'),
  'Tennis Doubles',
  'Cancelled due to weather.',
  'public',
  CURRENT_DATE + 4,
  '10:00', '11:00',
  4, 1,
  10.00, 19.56,
  1.0, 4.0,
  false,
  (CURRENT_DATE + 4 + TIME '10:00' - INTERVAL '2 hours')::TIMESTAMPTZ,
  'manual', true, NULL
),
-- S5: DRAFT private session on Plovdiv Main Pitch, 5 days out
(
  '00000000-0000-0000-0005-000000000005',
  '00000000-0000-0000-0003-000000000005',
  NULL,
  '00000000-0000-0000-0000-000000000005',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  'Private Training Match',
  'Invite-only competitive session.',
  'private',
  CURRENT_DATE + 5,
  '17:00', '18:00',
  14, 1,
  0, 0,
  3.0, 5.0,
  false,
  (CURRENT_DATE + 5 + TIME '17:00' - INTERVAL '2 hours')::TIMESTAMPTZ,
  NULL, false, NULL
)
ON CONFLICT (id) DO NOTHING;

-- Create booking for session S2 (the active/confirmed one) and link bidirectionally
INSERT INTO bookings (id, field_id, user_id, session_id, date, start_time, end_time, status, total_price_eur, total_price_local)
VALUES (
  '00000000-0000-0000-0004-000000000007',
  '00000000-0000-0000-0003-000000000002',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0005-000000000002',
  CURRENT_DATE + 1,
  '12:00', '13:00',
  'confirmed', 35.00, 68.45
)
ON CONFLICT (id) DO NOTHING;

-- Link S2 booking bidirectionally
UPDATE group_sessions
SET booking_id = '00000000-0000-0000-0004-000000000007'
WHERE id = '00000000-0000-0000-0005-000000000002';

-- Link S3 booking bidirectionally (booking b4 already exists)
UPDATE bookings
SET session_id = '00000000-0000-0000-0005-000000000003'
WHERE id = '00000000-0000-0000-0004-000000000004';

-- ─── 12. SESSION PARTICIPANTS ────────────────────────────
-- The participant count trigger will fire on these inserts,
-- but we already set current_participants above, so it will increment.
-- We temporarily disable the trigger to avoid double-counting.

ALTER TABLE session_participants DISABLE TRIGGER on_participant_change;

INSERT INTO session_participants (session_id, user_id, status, invited_by) VALUES
-- S1 (Draft Football): organizer confirmed + 1 requested
('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-000000000004', 'confirmed', NULL),
('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-000000000005', 'requested', NULL),

-- S2 (Active Football): organizer + 2 confirmed
('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-000000000005', 'confirmed', NULL),
('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-000000000004', 'confirmed', NULL),
('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-000000000003', 'confirmed', NULL),

-- S3 (Completed Football): organizer + 3 confirmed
('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0000-000000000004', 'confirmed', NULL),
('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0000-000000000005', 'confirmed', NULL),
('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0000-000000000003', 'confirmed', NULL),
('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0000-000000000002', 'confirmed', NULL),

-- S4 (Cancelled Tennis): organizer only
('00000000-0000-0000-0005-000000000004', '00000000-0000-0000-0000-000000000005', 'confirmed', NULL),

-- S5 (Private Draft): organizer + 1 invited
('00000000-0000-0000-0005-000000000005', '00000000-0000-0000-0000-000000000005', 'confirmed', NULL),
('00000000-0000-0000-0005-000000000005', '00000000-0000-0000-0000-000000000004', 'invited', '00000000-0000-0000-0000-000000000005')

ON CONFLICT (session_id, user_id) DO NOTHING;

ALTER TABLE session_participants ENABLE TRIGGER on_participant_change;

-- ─── 13. SESSION INVITES ─────────────────────────────────

INSERT INTO session_invites (session_id, invited_user_id, invite_code, status) VALUES
('00000000-0000-0000-0005-000000000005', '00000000-0000-0000-0000-000000000004', 'INVITE-S5-U4', 'pending')
ON CONFLICT DO NOTHING;

-- ─── 14. USER RATINGS ────────────────────────────────────
-- Rate players from the completed session S3

INSERT INTO user_ratings (rater_id, rated_id, session_id, sport_category_id, rating, skill_rating, sportsmanship_rating, comment) VALUES
-- user4 rates user5
(
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0005-000000000003',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  4, 4, 5,
  'Great teammate, solid skills!'
),
-- user5 rates user4
(
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0005-000000000003',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  5, 5, 4,
  'Excellent player, very competitive.'
),
-- user3 rates user4
(
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0005-000000000003',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  4, 3, 5,
  'Good sportsmanship.'
),
-- user3 rates user5
(
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0005-000000000003',
  (SELECT id FROM sport_categories WHERE slug = 'football'),
  3, 3, 4,
  NULL
)
ON CONFLICT (rater_id, rated_id, session_id) DO NOTHING;

-- The update_sport_ranking trigger should have auto-created/updated
-- user_sport_rankings entries for user4 and user5 in football.

-- ─── 15. VERIFICATION ────────────────────────────────────
-- Run these queries to verify the seed worked:

-- SELECT email, role, city FROM profiles ORDER BY email;
-- SELECT name, slug, city FROM clubs;
-- SELECT l.name, c.name AS club FROM locations l JOIN clubs c ON c.id = l.club_id;
-- SELECT f.name, l.name AS location, sc.name AS sport FROM fields f JOIN locations l ON l.id = f.location_id JOIN sport_categories sc ON sc.id = f.sport_category_id;
-- SELECT b.date, b.start_time, b.status, f.name AS field, p.email FROM bookings b JOIN fields f ON f.id = b.field_id JOIN profiles p ON p.id = b.user_id ORDER BY b.date;
-- SELECT gs.title, gs.is_confirmed, gs.is_cancelled, gs.cancelled_reason, gs.current_participants FROM group_sessions gs;
-- SELECT gs.title, sp.status, p.email FROM session_participants sp JOIN group_sessions gs ON gs.id = sp.session_id JOIN profiles p ON p.id = sp.user_id ORDER BY gs.title;
-- SELECT p.email, usr.rating, usr.total_ratings_received, sc.name AS sport FROM user_sport_rankings usr JOIN profiles p ON p.id = usr.user_id JOIN sport_categories sc ON sc.id = usr.sport_category_id;
