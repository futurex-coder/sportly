-- ============================================================
-- SPORTLY — Complete Database Schema for Supabase SQL Editor
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. ENUM TYPES ──────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('super_admin', 'club_admin', 'staff', 'trainer', 'client');
CREATE TYPE session_visibility AS ENUM ('public', 'private');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE session_participant_status AS ENUM ('invited', 'requested', 'confirmed', 'declined', 'waitlisted');

-- ─── 2. TABLES ──────────────────────────────────────────────

-- 4.1 profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  city TEXT,
  role user_role NOT NULL DEFAULT 'client',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.2 sport_categories
CREATE TABLE sport_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  color_primary TEXT,
  color_accent TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.3 clubs
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.4 club_members
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL CHECK (role IN ('club_admin', 'staff', 'trainer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- 4.5 locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'Bulgaria',
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  email TEXT,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, slug)
);

-- 4.6 location_schedules
CREATE TABLE location_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, day_of_week)
);

-- 4.7 location_images
CREATE TABLE location_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.8 fields
CREATE TABLE fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  sport_category_id UUID NOT NULL REFERENCES sport_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, slug)
);

-- 4.9 field_attributes
CREATE TABLE field_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  UNIQUE(field_id, attribute_key)
);

-- 4.10 field_booking_settings
CREATE TABLE field_booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE UNIQUE,
  slot_duration_minutes INT NOT NULL DEFAULT 60,
  buffer_minutes INT DEFAULT 0,
  price_per_slot_eur DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_per_slot_local DECIMAL(10,2),
  currency_local TEXT DEFAULT 'BGN',
  min_booking_notice_hours INT DEFAULT 1,
  max_booking_advance_days INT DEFAULT 30,
  allow_recurring BOOLEAN DEFAULT false,
  max_concurrent_bookings INT DEFAULT 1,
  cancellation_policy_hours INT DEFAULT 24,
  auto_confirm BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.11 field_availability
CREATE TABLE field_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  day_of_week day_of_week,
  specific_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (day_of_week IS NOT NULL OR specific_date IS NOT NULL)
);

-- 4.12 bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID,  -- FK added after group_sessions is created
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  total_price_eur DECIMAL(10,2),
  total_price_local DECIMAL(10,2),
  notes TEXT,
  booked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent double bookings
CREATE UNIQUE INDEX idx_bookings_no_overlap
  ON bookings (field_id, date, start_time)
  WHERE status NOT IN ('cancelled');

-- 4.13 group_sessions
CREATE TABLE group_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  organizer_id UUID NOT NULL REFERENCES profiles(id),
  sport_category_id UUID NOT NULL REFERENCES sport_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  visibility session_visibility NOT NULL DEFAULT 'public',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_participants INT NOT NULL DEFAULT 10,
  current_participants INT NOT NULL DEFAULT 0,
  price_per_person_eur DECIMAL(10,2) DEFAULT 0,
  price_per_person_local DECIMAL(10,2) DEFAULT 0,
  skill_level_min DECIMAL(3,1) DEFAULT 0,
  skill_level_max DECIMAL(3,1) DEFAULT 5,
  is_confirmed BOOLEAN DEFAULT false,
  confirmation_deadline TIMESTAMPTZ,
  cancelled_reason TEXT,
  is_cancelled BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Now add the FK from bookings → group_sessions
ALTER TABLE bookings
  ADD CONSTRAINT bookings_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES group_sessions(id) ON DELETE SET NULL;

-- 4.14 session_participants
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status session_participant_status NOT NULL DEFAULT 'confirmed',
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- 4.15 session_invites
CREATE TABLE session_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  invited_email TEXT,
  invited_user_id UUID REFERENCES profiles(id),
  invite_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- 4.16 user_sport_rankings
CREATE TABLE user_sport_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport_category_id UUID NOT NULL REFERENCES sport_categories(id),
  rating DECIMAL(3,1) NOT NULL DEFAULT 3.0 CHECK (rating >= 0 AND rating <= 5),
  total_ratings_received INT DEFAULT 0,
  total_sessions_played INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, sport_category_id)
);

-- 4.17 user_ratings
CREATE TABLE user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES profiles(id),
  rated_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID NOT NULL REFERENCES group_sessions(id),
  sport_category_id UUID NOT NULL REFERENCES sport_categories(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  skill_rating INT CHECK (skill_rating BETWEEN 1 AND 5),
  sportsmanship_rating INT CHECK (sportsmanship_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rater_id, rated_id, session_id),
  CHECK (rater_id != rated_id)
);

-- 4.18 rating_criteria
CREATE TABLE rating_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_category_id UUID REFERENCES sport_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE user_rating_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_rating_id UUID NOT NULL REFERENCES user_ratings(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES rating_criteria(id),
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE(user_rating_id, criteria_id)
);

-- ─── 3. INDEXES ─────────────────────────────────────────────

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_clubs_active ON clubs(is_active);
CREATE INDEX idx_club_members_user ON club_members(user_id);
CREATE INDEX idx_club_members_club ON club_members(club_id);
CREATE INDEX idx_locations_club ON locations(club_id);
CREATE INDEX idx_locations_city ON locations(city);
CREATE INDEX idx_fields_location ON fields(location_id);
CREATE INDEX idx_fields_sport ON fields(sport_category_id);
CREATE INDEX idx_field_attributes_field ON field_attributes(field_id);
CREATE INDEX idx_bookings_field_date ON bookings(field_id, date);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_sessions_field_date ON group_sessions(field_id, date);
CREATE INDEX idx_sessions_sport ON group_sessions(sport_category_id);
CREATE INDEX idx_sessions_visibility ON group_sessions(visibility);
CREATE INDEX idx_sessions_organizer ON group_sessions(organizer_id);
CREATE INDEX idx_sessions_confirmed ON group_sessions(is_confirmed) WHERE is_confirmed = false AND is_cancelled = false;
CREATE INDEX idx_sessions_deadline ON group_sessions(confirmation_deadline) WHERE is_confirmed = false AND is_cancelled = false;
CREATE INDEX idx_session_participants_user ON session_participants(user_id);
CREATE INDEX idx_session_participants_session ON session_participants(session_id);
CREATE INDEX idx_session_participants_status ON session_participants(session_id, status);
CREATE INDEX idx_user_sport_rankings_user ON user_sport_rankings(user_id);
CREATE INDEX idx_user_sport_rankings_sport ON user_sport_rankings(sport_category_id);
CREATE INDEX idx_user_sport_rankings_rating ON user_sport_rankings(rating DESC);
CREATE INDEX idx_user_ratings_rated ON user_ratings(rated_id);
CREATE INDEX idx_user_ratings_session ON user_ratings(session_id);

-- ─── 4. TRIGGERS ────────────────────────────────────────────

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'client'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update ranking when a new rating is inserted
CREATE OR REPLACE FUNCTION update_sport_ranking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_sport_rankings (user_id, sport_category_id, rating, total_ratings_received)
  VALUES (NEW.rated_id, NEW.sport_category_id, NEW.rating, 1)
  ON CONFLICT (user_id, sport_category_id) DO UPDATE SET
    rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 1)
      FROM user_ratings
      WHERE rated_id = NEW.rated_id
      AND sport_category_id = NEW.sport_category_id
    ),
    total_ratings_received = user_sport_rankings.total_ratings_received + 1,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_rating_created
  AFTER INSERT ON user_ratings
  FOR EACH ROW EXECUTE FUNCTION update_sport_ranking();

-- Auto-increment/decrement session participant count
CREATE OR REPLACE FUNCTION update_session_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE group_sessions SET current_participants = current_participants + 1 WHERE id = NEW.session_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'confirmed' THEN
    UPDATE group_sessions SET current_participants = current_participants - 1 WHERE id = OLD.session_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
    UPDATE group_sessions SET current_participants = current_participants + 1 WHERE id = NEW.session_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    UPDATE group_sessions SET current_participants = current_participants - 1 WHERE id = NEW.session_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_participant_change
  AFTER INSERT OR UPDATE OR DELETE ON session_participants
  FOR EACH ROW EXECUTE FUNCTION update_session_participant_count();

-- Auto-cancel overlapping draft sessions when a regular booking is confirmed
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

CREATE TRIGGER on_booking_cancel_draft_sessions
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION cancel_draft_sessions_on_booking();

-- Auto-cancel expired draft sessions (called by pg_cron every 15 minutes)
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

-- ─── 5. ENABLE ROW LEVEL SECURITY ──────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sport_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rating_details ENABLE ROW LEVEL SECURITY;

-- ─── 6. RLS POLICIES ───────────────────────────────────────

-- Helper: check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is club_admin for a given club
CREATE OR REPLACE FUNCTION is_club_admin(check_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = check_club_id
      AND user_id = auth.uid()
      AND role = 'club_admin'
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is a participant of a given session (bypasses RLS)
CREATE OR REPLACE FUNCTION is_session_participant(check_session_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_participants
    WHERE session_id = check_session_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is a member of a given club
CREATE OR REPLACE FUNCTION is_club_member(check_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = check_club_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── profiles ──

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Super admins can update any profile"
  ON profiles FOR UPDATE
  USING (is_super_admin());

-- ── sport_categories ──

CREATE POLICY "Anyone can view active sport categories"
  ON sport_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage sport categories"
  ON sport_categories FOR ALL
  USING (is_super_admin());

-- ── clubs ──

CREATE POLICY "Anyone can view active clubs"
  ON clubs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins full access to clubs"
  ON clubs FOR ALL
  USING (is_super_admin());

CREATE POLICY "Club admins can update own club"
  ON clubs FOR UPDATE
  USING (is_club_admin(id));

-- ── club_members ──

CREATE POLICY "Members can view co-members of same club"
  ON club_members FOR SELECT
  USING (is_club_member(club_id));

CREATE POLICY "Super admins full access to club_members"
  ON club_members FOR ALL
  USING (is_super_admin());

CREATE POLICY "Club admins can insert members"
  ON club_members FOR INSERT
  WITH CHECK (is_club_admin(club_id));

CREATE POLICY "Club admins can update members"
  ON club_members FOR UPDATE
  USING (is_club_admin(club_id));

CREATE POLICY "Club admins can delete members"
  ON club_members FOR DELETE
  USING (is_club_admin(club_id));

-- ── locations ──

CREATE POLICY "Anyone can view active locations"
  ON locations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Club members can view own club locations"
  ON locations FOR SELECT
  USING (is_club_member(club_id));

CREATE POLICY "Club admins can insert locations"
  ON locations FOR INSERT
  WITH CHECK (is_club_admin(club_id));

CREATE POLICY "Club admins can update locations"
  ON locations FOR UPDATE
  USING (is_club_admin(club_id));

CREATE POLICY "Club admins can delete locations"
  ON locations FOR DELETE
  USING (is_club_admin(club_id));

CREATE POLICY "Super admins full access to locations"
  ON locations FOR ALL
  USING (is_super_admin());

-- ── location_schedules ──

CREATE POLICY "Anyone can view location schedules"
  ON location_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locations WHERE id = location_schedules.location_id AND is_active = true
    )
  );

CREATE POLICY "Club admins can manage location schedules"
  ON location_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE id = location_schedules.location_id
        AND is_club_admin(club_id)
    )
  );

CREATE POLICY "Super admins full access to location_schedules"
  ON location_schedules FOR ALL
  USING (is_super_admin());

-- ── location_images ──

CREATE POLICY "Anyone can view location images"
  ON location_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locations WHERE id = location_images.location_id AND is_active = true
    )
  );

CREATE POLICY "Club admins can manage location images"
  ON location_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE id = location_images.location_id
        AND is_club_admin(club_id)
    )
  );

CREATE POLICY "Super admins full access to location_images"
  ON location_images FOR ALL
  USING (is_super_admin());

-- ── fields ──

CREATE POLICY "Anyone can view active fields"
  ON fields FOR SELECT
  USING (is_active = true);

CREATE POLICY "Club members can view own club fields"
  ON fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE id = fields.location_id AND is_club_member(club_id)
    )
  );

CREATE POLICY "Club admins can manage fields"
  ON fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE id = fields.location_id AND is_club_admin(club_id)
    )
  );

CREATE POLICY "Super admins full access to fields"
  ON fields FOR ALL
  USING (is_super_admin());

-- ── field_attributes ──

CREATE POLICY "Anyone can view field attributes"
  ON field_attributes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fields WHERE id = field_attributes.field_id AND is_active = true
    )
  );

CREATE POLICY "Club admins can manage field attributes"
  ON field_attributes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = field_attributes.field_id
        AND is_club_admin(locations.club_id)
    )
  );

CREATE POLICY "Super admins full access to field_attributes"
  ON field_attributes FOR ALL
  USING (is_super_admin());

-- ── field_booking_settings ──

CREATE POLICY "Anyone can view field booking settings"
  ON field_booking_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fields WHERE id = field_booking_settings.field_id AND is_active = true
    )
  );

CREATE POLICY "Club admins can manage field booking settings"
  ON field_booking_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = field_booking_settings.field_id
        AND is_club_admin(locations.club_id)
    )
  );

CREATE POLICY "Super admins full access to field_booking_settings"
  ON field_booking_settings FOR ALL
  USING (is_super_admin());

-- ── field_availability ──

CREATE POLICY "Club members can view field availability"
  ON field_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = field_availability.field_id
        AND is_club_member(locations.club_id)
    )
  );

CREATE POLICY "Public can view field availability for active fields"
  ON field_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fields WHERE id = field_availability.field_id AND is_active = true
    )
  );

CREATE POLICY "Club admins can manage field availability"
  ON field_availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = field_availability.field_id
        AND is_club_admin(locations.club_id)
    )
  );

CREATE POLICY "Super admins full access to field_availability"
  ON field_availability FOR ALL
  USING (is_super_admin());

-- ── bookings ──

CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Club members can view club bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = bookings.field_id
        AND is_club_member(locations.club_id)
    )
  );

CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Club admins can update club bookings"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = bookings.field_id
        AND is_club_admin(locations.club_id)
    )
  );

CREATE POLICY "Users can cancel own bookings"
  ON bookings FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Club admins can delete club bookings"
  ON bookings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = bookings.field_id
        AND is_club_admin(locations.club_id)
    )
  );

CREATE POLICY "Super admins full access to bookings"
  ON bookings FOR ALL
  USING (is_super_admin());

-- ── group_sessions ──

CREATE POLICY "Anyone can view public sessions"
  ON group_sessions FOR SELECT
  USING (visibility = 'public' AND is_cancelled = false);

CREATE POLICY "Organizer can view own sessions"
  ON group_sessions FOR SELECT
  USING (organizer_id = auth.uid());

CREATE POLICY "Participants can view their sessions"
  ON group_sessions FOR SELECT
  USING (is_session_participant(id));

CREATE POLICY "Club members can view club sessions"
  ON group_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = group_sessions.field_id
        AND is_club_member(locations.club_id)
    )
  );

CREATE POLICY "Authenticated users can create sessions"
  ON group_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Organizer can update own sessions"
  ON group_sessions FOR UPDATE
  USING (organizer_id = auth.uid());

CREATE POLICY "Club admins can update club sessions"
  ON group_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = group_sessions.field_id
        AND is_club_admin(locations.club_id)
    )
  );

CREATE POLICY "Organizer can delete own sessions"
  ON group_sessions FOR DELETE
  USING (organizer_id = auth.uid());

CREATE POLICY "Club admins can delete club sessions"
  ON group_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM fields
      JOIN locations ON locations.id = fields.location_id
      WHERE fields.id = group_sessions.field_id
        AND is_club_admin(locations.club_id)
    )
  );

-- ── session_participants ──

CREATE POLICY "Session members can view participants"
  ON session_participants FOR SELECT
  USING (
    is_session_participant(session_id)
    OR
    EXISTS (
      SELECT 1 FROM group_sessions
      WHERE id = session_participants.session_id AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can join sessions"
  ON session_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own participation status"
  ON session_participants FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Organizer can update participant status"
  ON session_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_sessions
      WHERE id = session_participants.session_id AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave sessions"
  ON session_participants FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Organizer can remove participants"
  ON session_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_sessions
      WHERE id = session_participants.session_id AND organizer_id = auth.uid()
    )
  );

-- ── session_invites ──

CREATE POLICY "Invited users can view their invites"
  ON session_invites FOR SELECT
  USING (invited_user_id = auth.uid() OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Organizer can view session invites"
  ON session_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_sessions
      WHERE id = session_invites.session_id AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizer can create invites"
  ON session_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_sessions
      WHERE id = session_invites.session_id AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Invited users can update invite status"
  ON session_invites FOR UPDATE
  USING (invited_user_id = auth.uid());

-- ── user_sport_rankings ──

CREATE POLICY "Anyone can view rankings (public leaderboards)"
  ON user_sport_rankings FOR SELECT
  USING (true);

-- Insert/update managed by trigger only (no direct user access)

-- ── user_ratings ──

CREATE POLICY "Rated users can view ratings about them"
  ON user_ratings FOR SELECT
  USING (rated_id = auth.uid());

CREATE POLICY "Raters can view own ratings"
  ON user_ratings FOR SELECT
  USING (rater_id = auth.uid());

CREATE POLICY "Participants can rate after session"
  ON user_ratings FOR INSERT
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM session_participants
      WHERE session_id = user_ratings.session_id AND user_id = auth.uid() AND status = 'confirmed'
    )
    AND EXISTS (
      SELECT 1 FROM session_participants
      WHERE session_id = user_ratings.session_id AND user_id = user_ratings.rated_id AND status = 'confirmed'
    )
  );

-- ── rating_criteria ──

CREATE POLICY "Anyone can view active rating criteria"
  ON rating_criteria FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage rating criteria"
  ON rating_criteria FOR ALL
  USING (is_super_admin());

-- ── user_rating_details ──

CREATE POLICY "Users can view rating details for their ratings"
  ON user_rating_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_ratings
      WHERE id = user_rating_details.user_rating_id
        AND (rated_id = auth.uid() OR rater_id = auth.uid())
    )
  );

CREATE POLICY "Raters can insert rating details"
  ON user_rating_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_ratings
      WHERE id = user_rating_details.user_rating_id AND rater_id = auth.uid()
    )
  );

-- ─── 7. SEED DATA ───────────────────────────────────────────

INSERT INTO sport_categories (name, slug, icon, color_primary, color_accent, sort_order) VALUES
('Football', 'football', '⚽', '#16a34a', '#dc2626', 1),
('Padel', 'padel', '🏓', '#7c3aed', '#a855f7', 2),
('Tennis', 'tennis', '🎾', '#ca8a04', '#eab308', 3),
('Basketball', 'basketball', '🏀', '#ea580c', '#f97316', 4),
('Volleyball', 'volleyball', '🏐', '#3b82f6', '#60a5fa', 5),
('Badminton', 'badminton', '🏸', '#14b8a6', '#2dd4bf', 6),
('Table Tennis', 'table-tennis', '🏓', '#f43f5e', '#fb7185', 7),
('Squash', 'squash', '🎾', '#8b5cf6', '#a78bfa', 8),
('Swimming', 'swimming', '🏊', '#0ea5e9', '#38bdf8', 9),
('Fitness', 'fitness', '💪', '#64748b', '#94a3b8', 10),
('Boxing', 'boxing', '🥊', '#dc2626', '#ef4444', 11),
('Martial Arts', 'martial-arts', '🥋', '#1e293b', '#475569', 12),
('Yoga', 'yoga', '🧘', '#d946ef', '#e879f9', 13),
('Dance', 'dance', '💃', '#ec4899', '#f472b6', 14),
('Climbing', 'climbing', '🧗', '#78716c', '#a8a29e', 15),
('Cricket', 'cricket', '🏏', '#65a30d', '#84cc16', 16),
('Rugby', 'rugby', '🏉', '#b45309', '#d97706', 17),
('Golf', 'golf', '⛳', '#166534', '#22c55e', 18),
('Cycling', 'cycling', '🚴', '#0891b2', '#06b6d4', 19),
('Running', 'running', '🏃', '#9333ea', '#a855f7', 20);

INSERT INTO rating_criteria (name, description, weight, sort_order) VALUES
('Skill', 'Technical ability and game understanding', 1.0, 1),
('Sportsmanship', 'Fair play, attitude, and respect', 1.0, 2),
('Teamwork', 'Communication and collaboration', 0.8, 3),
('Punctuality', 'Arrives on time and prepared', 0.5, 4);

-- ═══════════════════════════════════════════════════════
-- BOOKING ENGINE: Atomic safe-booking function
-- Prevents race conditions via row-level locking on the field row,
-- then checks for overlapping non-cancelled bookings using time range
-- overlap (start_time < p_end_time AND end_time > p_start_time).
-- The unique partial index idx_bookings_no_overlap is the final safety net.
-- Always inserts with status = 'confirmed'.
-- ═══════════════════════════════════════════════════════

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
  -- Lock the field row to serialise concurrent bookings for this field
  PERFORM id FROM fields WHERE id = p_field_id FOR UPDATE;

  -- Time range overlap check: any existing non-cancelled booking that overlaps [p_start_time, p_end_time)
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

-- ═══════════════════════════════════════════════════════
-- pg_cron: Schedule auto-cancel for expired draft sessions
-- Requires pg_cron extension enabled in Supabase Dashboard → Extensions.
-- Run this block in the Supabase SQL Editor after enabling pg_cron:
-- ═══════════════════════════════════════════════════════
SELECT cron.schedule(
  'auto-cancel-expired-sessions',
  '*/15 * * * *',
  $$ SELECT auto_cancel_expired_sessions(); $$
);
