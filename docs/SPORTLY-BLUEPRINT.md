# SPORTLY — COMPLETE PROJECT BLUEPRINT

> Single file. Complete specification. Nothing skipped.
> For use with Cursor AI to build the entire project.

---

# TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Setup](#2-tech-stack--setup)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Database Schema (Supabase)](#4-database-schema-supabase)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Impersonation System](#6-impersonation-system)
7. [Super Admin Pages](#7-super-admin-pages)
8. [Club Admin Dashboard Pages](#8-club-admin-dashboard-pages)
9. [Public Pages (Client-Facing)](#9-public-pages-client-facing)
10. [Daily Schedule Grid (Core Booking UI)](#10-daily-schedule-grid-core-booking-ui)
11. [Booking System Logic](#11-booking-system-logic)
12. [Group Sessions System](#12-group-sessions-system)
13. [Ranking & Rating System](#13-ranking--rating-system)
14. [UI Components & Design System](#14-ui-components--design-system)
15. [File & Folder Structure](#15-file--folder-structure)
16. [Implementation Phases](#16-implementation-phases)
17. [Requirements Traceability](#17-requirements-traceability)

---

# 1. PROJECT OVERVIEW

## What Is Sportly

Sportly is a single-portal SaaS platform for sport facility booking. Companies (Clubs) register, set up their locations and fields, and public users browse by sport category to find and book pitches, courts, and facilities.

**One app. One URL. Role-based views. No separate portals.**

## Core Concepts

```
Super Admin (Sportly operator)
  └── manages Sport Categories (Football, Padel, Tennis, ...)
  └── manages all Clubs (can impersonate any club)

Club (a company)
  ├── Club Admin, Staff, Trainers (3 role levels)
  ├── Location 1 (physical venue with address, phone, schedule)
  │   ├── Field A (Football, artificial turf, outdoor, lit, 40x20m)
  │   │   ├── Booking Settings (60min slots, 50€, 1hr notice, 30 day advance)
  │   │   ├── Availability (Mon-Fri 08-22, Sat-Sun 09-20, blocked Dec 25)
  │   │   ├── Bookings
  │   │   └── Group Sessions
  │   ├── Field B (Padel, hard court, indoor, lit)
  │   └── Field C (Football, natural grass, outdoor, no light)
  ├── Location 2
  │   └── ...
  └── Location 3
      └── ...

Public User (Client)
  ├── Browse by sport category → see clubs/fields
  ├── Book directly (pick date → pick slot → confirm)
  ├── Create group sessions (public or private, invite people)
  ├── Join other people's group sessions
  ├── Has a RANKING per sport (e.g., Football: 4.2/5, Padel: 3.8/5)
  └── Can RATE other users they played with in a group session
```

---

# 2. TECH STACK & SETUP

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Template | [Vercel Next.js SaaS Starter](https://vercel.com/templates/next.js/next-js-saas-starter) |
| Database | **Supabase** (Postgres) |
| Auth | Supabase Auth (`@supabase/ssr`) |
| ORM | Drizzle ORM (pointing at Supabase Postgres) |
| Styling | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |
| File Storage | Supabase Storage (logos, photos) |
| Realtime | Supabase Realtime (live slot availability) |
| Icons | lucide-react |

## Initial Setup

```bash
# SPORTLY — Starter Cleanup Script (PowerShell)
# Run from the project root folder (cd sportly)

# 1. Remove Stripe
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue lib/payments
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue app/api/stripe
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue app/pricing

# 2. Remove existing auth (we'll replace with Supabase)
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue lib/auth

# 3. Remove existing page content (keep layout.tsx for now)
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "app/(dashboard)"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "app/(login)"

# 4. Clear the existing Drizzle schema (we'll write our own)
Set-Content -Path lib/db/schema.ts -Value ""
Set-Content -Path lib/db/queries.ts -Value ""
Set-Content -Path lib/db/seed.ts -Value ""
if (Test-Path lib/db/migrations) {
    Get-ChildItem lib/db/migrations -Recurse | Remove-Item -Force -Recurse
}

# 5. Clean up the root page
Set-Content -Path app/page.tsx -Value 'export default function HomePage() { return <div>Sportly</div> }'

Write-Host "Cleanup complete. Now manually remove STRIPE_* variables from .env and .env.example" -ForegroundColor Green
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

# 3. USER ROLES & PERMISSIONS

## Role Hierarchy

| Role | Scope | What They Can Do |
|---|---|---|
| `super_admin` | Global | Manage sport categories. View/manage all clubs. Impersonate any club. Create new clubs. Manage all users. |
| `club_admin` | Club | Full control of their club: create/edit/delete locations, fields, booking settings, schedules. Manage team (invite staff/trainers). View all bookings. Create manual bookings. |
| `staff` | Club | View and manage bookings. Cannot change settings, fields, or team. |
| `trainer` | Club | View their assigned group sessions. Mark attendance. Limited read access. |
| `client` | Global | Browse sports/clubs. Book fields. Create/join group sessions. Rate players. View own bookings/rankings. |

## Where Roles Are Stored

- **Global role** (`super_admin` or `client`): stored in `profiles.role`
- **Club-scoped role** (`club_admin`, `staff`, `trainer`): stored in `club_members.role`
- A user can be a `client` globally AND a `club_admin` for Club A AND a `trainer` for Club B.

---

# 4. DATABASE SCHEMA (SUPABASE)

## Enums

```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'club_admin', 'staff', 'trainer', 'client');
CREATE TYPE session_visibility AS ENUM ('public', 'private');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE session_participant_status AS ENUM ('invited', 'requested', 'confirmed', 'declined', 'waitlisted');
```

## Tables

### 4.1 `profiles`
Extends Supabase `auth.users`. Auto-created via trigger on user signup.

```sql
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
```

### 4.2 `sport_categories`
Global list. Managed only by super_admin. Clubs pick from these when creating fields.

```sql
CREATE TABLE sport_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,            -- "Football", "Padel", "Tennis"
  slug TEXT NOT NULL UNIQUE,            -- "football", "padel", "tennis"
  icon TEXT,                            -- icon name or emoji
  color_primary TEXT,                   -- hex color for theming, e.g. "#16a34a"
  color_accent TEXT,                    -- secondary theme color
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 `clubs`
A company/organization that manages sport facilities.

```sql
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
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 `club_members`
Maps users to clubs with a role. **Requirement #2: 3 levels of roles — admin, staff, trainers.**

```sql
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL CHECK (role IN ('club_admin', 'staff', 'trainer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);
```

### 4.5 `locations`
Physical venues belonging to a club. **Requirement #3: Each club may have many locations. #8: Each location has phone/address.**

```sql
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
  phone TEXT,                            -- Requirement #8: own phone
  email TEXT,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, slug)
);
```

### 4.6 `location_schedules`
Weekly operating hours. One row per day per location. **Requirement #7: daily/weekly schedule.**

```sql
CREATE TABLE location_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  open_time TIME NOT NULL,              -- e.g. '08:00'
  close_time TIME NOT NULL,             -- e.g. '22:00'
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, day_of_week)
);
```

### 4.7 `location_images`
Multiple photos per location for the gallery.

```sql
CREATE TABLE location_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.8 `fields`
A bookable resource (pitch, court, room). **Requirement #4: Each location may have different sports or many fields in one sport. #16: Companies select sport category when creating resources.**

```sql
CREATE TABLE fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  sport_category_id UUID NOT NULL REFERENCES sport_categories(id),
  name TEXT NOT NULL,                    -- "Pitch 1", "Court A"
  slug TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, slug)
);
```

### 4.9 `field_attributes`
Flexible key-value attributes. **Requirement #6: lightning, fitness, indoor, outdoor, size, pavement/floor type, etc.**

```sql
CREATE TABLE field_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  UNIQUE(field_id, attribute_key)
);
```

**Standard attribute keys** (enforced in app logic):

| Key | Possible Values | Description |
|---|---|---|
| `surface_type` | grass, artificial_turf, clay, hard_court, wood, rubber, concrete, sand, carpet, other | Floor/pavement type |
| `environment` | indoor, outdoor, covered | Indoor/outdoor |
| `has_lighting` | true, false | Lighting available |
| `has_changing_rooms` | true, false | Changing rooms & showers |
| `has_parking` | true, false | Parking available |
| `has_cafe_bar` | true, false | Café or bar on site |
| `has_fitness_area` | true, false | Fitness equipment nearby |
| `has_equipment_rental` | true, false | Ball/racket rental |
| `size` | freeform, e.g. "40x20m" | Pitch/court dimensions |
| `max_players` | integer string, e.g. "12" | Maximum players |
| `format` | "5x5", "6x6", "9x9", "singles", "doubles" | Game format |

### 4.10 `field_booking_settings`
Controls slot generation. **Requirement #5: Each field has different settings for booking slots and availability.**

```sql
CREATE TABLE field_booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE UNIQUE,
  slot_duration_minutes INT NOT NULL DEFAULT 60,        -- 30, 60, 90, 120
  buffer_minutes INT DEFAULT 0,                          -- gap between bookings
  price_per_slot_eur DECIMAL(10,2) NOT NULL DEFAULT 0,   -- price in EUR
  price_per_slot_local DECIMAL(10,2),                    -- price in local currency (BGN)
  currency_local TEXT DEFAULT 'BGN',
  min_booking_notice_hours INT DEFAULT 1,                -- how far in advance minimum
  max_booking_advance_days INT DEFAULT 30,               -- how far out maximum
  allow_recurring BOOLEAN DEFAULT false,
  max_concurrent_bookings INT DEFAULT 1,                 -- for shared resources
  cancellation_policy_hours INT DEFAULT 24,              -- free cancellation before this
  auto_confirm BOOLEAN DEFAULT true,                     -- auto-confirm or require admin approval
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.11 `field_availability`
Per-field overrides on top of location schedule. **Requirement #5 continued.**

```sql
CREATE TABLE field_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  day_of_week day_of_week,              -- NULL means specific date override
  specific_date DATE,                    -- NULL means recurring weekly rule
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,     -- false = blocked/closed
  reason TEXT,                           -- "Maintenance", "Tournament", etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (day_of_week IS NOT NULL OR specific_date IS NOT NULL)
);
```

### 4.12 `bookings`

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID REFERENCES group_sessions(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  total_price_eur DECIMAL(10,2),
  total_price_local DECIMAL(10,2),
  notes TEXT,
  booked_by UUID REFERENCES profiles(id),    -- who created it (for manual bookings by admin)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent double bookings (range overlap protection)
CREATE UNIQUE INDEX idx_bookings_no_overlap
  ON bookings (field_id, date, start_time)
  WHERE status NOT IN ('cancelled');
```

> **Regular bookings are always `confirmed`.** There is no `pending` state for non-session bookings. The `pending` status exists in the enum only for potential future use (e.g., payment gateway confirmation). `create_booking_safe` always inserts with `status = 'confirmed'`.
>
> **Bidirectional link:** `bookings.session_id` points to the session that owns this booking. `group_sessions.booking_id` points back to the booking created when a session is confirmed. Both are set atomically during `confirmGroupSession`.

### 4.13 `group_sessions`
**Requirement #9: private or public. #10: each field may have group sessions. #18: create public/private sessions and invite people.**

```sql
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
  skill_level_min DECIMAL(3,1) DEFAULT 0,    -- minimum ranking to join (0 = any)
  skill_level_max DECIMAL(3,1) DEFAULT 5,    -- maximum ranking to join (5 = any)
  is_confirmed BOOLEAN DEFAULT false,         -- organizer must confirm to reserve the slot
  confirmation_deadline TIMESTAMPTZ,          -- auto-cancel if not confirmed by this time (start_time - 2h)
  cancelled_reason TEXT,                      -- 'manual' | 'deadline_expired' | 'slot_taken'
  is_cancelled BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,                   -- set when session is marked complete
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

> **Draft session lifecycle:** Sessions are created as drafts (`is_confirmed = false`, `booking_id = NULL`). No slot is reserved until the organizer confirms. On confirmation, a booking is created via `create_booking_safe`, the slot is reserved, and `is_confirmed` is set to `true`. If the slot is already taken, confirmation fails. Unconfirmed sessions past their `confirmation_deadline` are auto-cancelled with `cancelled_reason = 'deadline_expired'`. If another user books the slot, all overlapping draft sessions are auto-cancelled with `cancelled_reason = 'slot_taken'`.

> **Session statuses (computed from columns):** Draft (`is_confirmed = false, is_cancelled = false`), Active (`is_confirmed = true, completed_at = NULL, is_cancelled = false`), Completed (`completed_at IS NOT NULL`), Cancelled (`is_cancelled = true, cancelled_reason IN ('manual')`), Expired (`is_cancelled = true, cancelled_reason = 'deadline_expired'`).

### 4.14 `session_participants`

```sql
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status session_participant_status NOT NULL DEFAULT 'confirmed',
  invited_by UUID REFERENCES profiles(id),    -- who sent the invite
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);
```

> **Participant status flow:**
> - `invited` — user has been invited to a private session, hasn't responded yet.
> - `requested` — user requested to join a public session, waiting for organizer approval.
> - `confirmed` — user is confirmed to participate (organizer approved request, or user accepted invite, or organizer added directly).
> - `declined` — user declined the invite or organizer declined the join request.
> - `waitlisted` — session is full, user is on the waitlist.
>
> **Public sessions:** Anyone can request to join (`status = 'requested'`). Organizer approves → `confirmed`. Organizer declines → `declined`.
> **Private sessions:** Users can only join via invite. Accepting invite → `status = 'confirmed'` immediately.

### 4.15 `session_invites`
For private sessions — invite links and direct invites. **Requirement #18: invite people to join.**

```sql
CREATE TABLE session_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  invited_email TEXT,                       -- email invite (user may not exist yet)
  invited_user_id UUID REFERENCES profiles(id),  -- direct user invite
  invite_code TEXT UNIQUE,                  -- shareable invite link code
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

### 4.16 `user_sport_rankings`
**Requirement #19: Each public user will have ranking for each sport.**

```sql
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
```

### 4.17 `user_ratings`
**Requirement #20: Each public user can give rank to another user if they have played together in group session.**

```sql
CREATE TABLE user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES profiles(id),
  rated_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID NOT NULL REFERENCES group_sessions(id),
  sport_category_id UUID NOT NULL REFERENCES sport_categories(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),   -- 1-5 stars
  skill_rating INT CHECK (skill_rating BETWEEN 1 AND 5), -- skill level
  sportsmanship_rating INT CHECK (sportsmanship_rating BETWEEN 1 AND 5), -- fair play
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- One rating per rater per rated per session
  UNIQUE(rater_id, rated_id, session_id),
  -- Cannot rate yourself
  CHECK (rater_id != rated_id)
);
```

### 4.18 `rating_criteria`
Configurable rating dimensions per sport (extensible).

```sql
CREATE TABLE rating_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_category_id UUID REFERENCES sport_categories(id),  -- NULL = applies to all sports
  name TEXT NOT NULL,                      -- "Skill", "Sportsmanship", "Teamwork", "Punctuality"
  description TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0,         -- how much this affects overall rating
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
```

## Auto-Create Profile Trigger

```sql
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
```

## Auto-Update Ranking Trigger

When a new rating is inserted, recalculate the rated user's average ranking for that sport:

```sql
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
```

## Auto-Increment Session Participant Count Trigger

```sql
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
```

## Auto-Cancel Draft Sessions When Slot Is Booked

When a regular booking is inserted (non-session booking), all **draft** group sessions overlapping that slot are auto-cancelled with `cancelled_reason = 'slot_taken'`.

```sql
CREATE OR REPLACE FUNCTION cancel_draft_sessions_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire for confirmed bookings that are NOT linked to a session
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
```

## Auto-Cancel Expired Draft Sessions (pg_cron)

Runs every 15 minutes. Cancels any unconfirmed session whose `confirmation_deadline` has passed.

```sql
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

-- pg_cron job (run via Supabase SQL editor or migration)
SELECT cron.schedule(
  'auto-cancel-expired-sessions',
  '*/15 * * * *',
  $$ SELECT auto_cancel_expired_sessions(); $$
);
```

## Key Indexes

```sql
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
```

## Row Level Security (RLS)

Enable RLS on ALL tables. Summary of policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | Own profile; club members can see co-members; super_admin all | Self (via trigger) | Own profile; super_admin any | — |
| sport_categories | Public (active ones) | super_admin | super_admin | super_admin |
| clubs | Public (active ones) | super_admin | club_admin of that club; super_admin | super_admin |
| club_members | Members of same club; super_admin | club_admin of that club; super_admin | club_admin; super_admin | club_admin; super_admin |
| locations | Public (active); club members see own | club_admin of club | club_admin | club_admin |
| location_schedules | Public; club members | club_admin | club_admin | club_admin |
| fields | Public (active); club members see own | club_admin | club_admin | club_admin |
| field_attributes | Public; club members | club_admin | club_admin | club_admin |
| field_booking_settings | Public; club members | club_admin | club_admin | club_admin |
| field_availability | Club members | club_admin | club_admin | club_admin |
| bookings | Own bookings; club members see their club's | Authenticated users | Own + club_admin | Own (cancel) + club_admin |
| group_sessions | Public sessions; own private sessions; club members | Authenticated | Organizer + club_admin | Organizer + club_admin |
| session_participants | Session members; organizer | Authenticated (join) | Own status; organizer | Own (leave); organizer |
| user_sport_rankings | Public (for leaderboards) | Via trigger only | Via trigger only | — |
| user_ratings | Rated user can see; rater can see own | Must be participant in session | — | — |

---

## Seed Data: Sport Categories

Insert these on first deploy:

```sql
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
```

## Seed Data: Rating Criteria

```sql
INSERT INTO rating_criteria (name, description, weight, sort_order) VALUES
('Skill', 'Technical ability and game understanding', 1.0, 1),
('Sportsmanship', 'Fair play, attitude, and respect', 1.0, 2),
('Teamwork', 'Communication and collaboration', 0.8, 3),
('Punctuality', 'Arrives on time and prepared', 0.5, 4);
```

---

# 5. AUTHENTICATION & AUTHORIZATION

## Supabase Client Files

### `src/lib/supabase/client.ts` (Browser)
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/server.ts` (Server Components, Server Actions, Route Handlers)
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server component read-only */ }
        },
      },
    }
  )
}
```

### `src/lib/supabase/admin.ts` (Service Role — server-only)
```ts
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

## Middleware (`src/middleware.ts`)

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/admin', '/my']
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))
  if (!user && isProtected) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/my/:path*'],
}
```

## Auth Helper Functions (`src/lib/auth/helpers.ts`)

```ts
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  return profile
}

export async function getCurrentUserWithClubRole(clubId: string) {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('club_members').select('role')
    .eq('user_id', user.id).eq('club_id', clubId).single()
  return { ...user, clubRole: membership?.role ?? null }
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') redirect('/auth/login')
  return user
}

export async function requireClubAccess(clubId: string) {
  const user = await getCurrentUserWithClubRole(clubId)
  if (!user) redirect('/auth/login')
  if (user.role === 'super_admin') return { ...user, clubRole: 'club_admin' as const }
  if (!user.clubRole) redirect('/')
  return user
}
```

## Auth Pages

### `/auth/login`
- Email + password via `supabase.auth.signInWithPassword()`
- Optional: Google OAuth via `supabase.auth.signInWithOAuth({ provider: 'google' })`
- After login, redirect based on role:
  - `super_admin` → `/admin`
  - Has `club_members` record → `/dashboard`
  - `client` → `/` (or the redirect param)

### `/auth/register`
- Email + password + full name
- `supabase.auth.signUp()` — profile created by trigger with role `client`

### `/auth/callback`
- OAuth callback: `supabase.auth.exchangeCodeForSession(code)`

### Inviting Club Members
- Club admin enters email + role on team page
- If user exists: insert `club_members` row, send notification
- If new: `supabaseAdmin.auth.admin.inviteUserByEmail()` + insert `club_members` row

---

# 6. IMPERSONATION SYSTEM

**Requirement #14: Super user can impersonate companies.**

Impersonation does NOT switch auth sessions. It uses **server-side cookies**.

## Implementation (`src/lib/auth/impersonation.ts`)

```ts
import { cookies } from 'next/headers'

// CLUB IMPERSONATION (Super Admin → Club)
export async function setImpersonatedClub(clubId: string) {
  const cookieStore = await cookies()
  cookieStore.set('impersonated_club_id', clubId, {
    httpOnly: true, path: '/', maxAge: 60 * 60 * 8
  })
}
export async function getImpersonatedClub(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('impersonated_club_id')?.value ?? null
}
export async function clearImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete('impersonated_club_id')
}

// LOCATION SCOPING (Club Admin → Location)
export async function setActiveLocation(locationId: string | null) {
  const cookieStore = await cookies()
  if (locationId) {
    cookieStore.set('active_location_id', locationId, { path: '/' })
  } else {
    cookieStore.delete('active_location_id')
  }
}
export async function getActiveLocationId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('active_location_id')?.value ?? null
}

// GET ACTIVE CLUB (works for both regular members and impersonating super admins)
export async function getActiveClubId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.role === 'super_admin') {
    return await getImpersonatedClub()
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('club_members').select('club_id')
    .eq('user_id', user.id).limit(1).single()
  return data?.club_id ?? null
}
```

## UX Flow

1. **Super Admin** goes to `/admin` → sees dropdown with all clubs → selects one → cookie set → redirected to `/dashboard`
2. **Dashboard layout** checks for impersonation cookie → shows yellow banner: "⚠️ Viewing as: [Club Name] | [Exit Impersonation]"
3. All dashboard queries use `getActiveClubId()` to scope data
4. "Exit" clears cookie → redirect to `/admin`

5. **Club Admin** enters dashboard → sees **location dropdown** in top bar
6. Selecting a location sets `active_location_id` cookie → all bookings/fields filter to that location
7. "All Locations" option clears the cookie

---

# 7. SUPER ADMIN PAGES

Route group: `(admin)` — all require `super_admin` role.

## Layout: `src/app/(admin)/layout.tsx`

- Sidebar: Clubs, Sport Categories, Users
- Top bar: user info, logout
- Impersonation banner (when active)

## Page: `/admin/clubs`

**Requirement #1: Create many clubs. #14: Impersonate.**

- **Club Impersonation Dropdown** (prominent, at top): searchable combobox listing all clubs. Select → impersonate → redirect to `/dashboard`
- **Clubs Table**: Name, Slug, Email, Locations count, Members count, Active toggle, Created date
- **Actions**: Edit (modal), Deactivate, Delete
- **"Create Club" button** → modal: name, auto-slug, email, phone, description, logo upload
- After creating → prompt to invite first club_admin by email

## Page: `/admin/sport-categories`

**Requirement #12: Many categories. #15: Super user creates sport categories.**

- Sortable list: Name, Slug, Icon, Color swatch, Active toggle, Sort Order
- Drag-to-reorder (updates sort_order)
- "Add Category" → modal: name, slug, icon, color_primary, color_accent, description
- Edit inline or modal
- Toggle active/inactive
- Cannot delete if fields reference it (show count + warning)

## Page: `/admin/users`

- Table: Name, Email, Global Role, Clubs (badges), Created date
- Filter by role, search by name/email
- Click → edit global role (promote to super_admin or set to client)
- View club memberships

## Server Actions: `src/lib/actions/admin-actions.ts`

```ts
'use server'
export async function createClub(data)
export async function updateClub(clubId, data)
export async function deleteClub(clubId)
export async function toggleClubActive(clubId, isActive)
export async function createSportCategory(data)
export async function updateSportCategory(id, data)
export async function deleteSportCategory(id)
export async function reorderSportCategories(orderedIds)
export async function updateUserRole(userId, role)
export async function impersonateClub(clubId)
export async function stopImpersonation()
```

---

# 8. CLUB ADMIN DASHBOARD PAGES

Route group: `(dashboard)` — requires club member role OR super_admin impersonating.

**Requirement #11: Easy navigation to create/list locations.**

## Layout: `src/app/(dashboard)/layout.tsx`

- **Impersonation banner** (yellow, if super_admin impersonating)
- **Top bar**: Club name, **Location Selector Dropdown** (scopes all views to a location), user avatar, logout
- **Sidebar**: Overview, Locations, Bookings, Group Sessions, Team, Settings

## Page: `/dashboard` (Overview)

- Stats cards: Total Locations, Total Fields, Today's Bookings, Upcoming Sessions, Total Active Members
- Quick actions: "Add Location", "View Today's Bookings"
- Recent bookings list (last 5)

## Page: `/dashboard/locations`

**Requirement #3: Many locations. #11: Easy to create and list.**

- Grid of location cards: cover image, name, address, phone, field count, active badge
- "Add Location" button → `/dashboard/locations/new`
- Click card → `/dashboard/locations/[id]`

### `/dashboard/locations/new` — **SETUP WIZARD** (few steps)

**Step 1: Basic Info**
- Name*, address*, city*, country, postal code
- Phone*, email
- Description (rich text)
- Cover image upload

**Step 2: Weekly Schedule**
- 7-day grid: day name | closed toggle | open time | close time
- Pre-filled defaults: Mon-Fri 08:00–22:00, Sat-Sun 09:00–20:00
- "Copy to all weekdays" shortcut button

**Step 3: Add Fields** (can add multiple, or skip)
- For each field:
  - Name*, sport category dropdown (from global list — **Req #16**)
  - Environment: indoor/outdoor/covered
  - Surface type dropdown
  - Has lighting toggle
  - Slot duration: 30/60/90/120 min
  - Price per slot (EUR + local)
- "Add Another Field" button
- "Skip — I'll add fields later" option

**Step 4: Review & Create**
- Summary of everything
- "Create Location" → creates location + schedules + fields + field_attributes + booking_settings in one transaction
- Redirect to `/dashboard/locations/[id]` with success toast

### `/dashboard/locations/[id]` — Location Detail

**Tabs:**

**Info Tab**: Edit name, address, phone, email, description, images. Upload gallery images.

**Fields Tab**: List of fields at this location.
- Each card: name, sport category badge, surface/environment/lighting icons, price, active toggle
- "Add Field" → `/dashboard/locations/[id]/fields/new`
- Click → `/dashboard/locations/[id]/fields/[fieldId]`

**Schedule Tab**: Edit weekly schedule grid (same as wizard step 2)

### `/dashboard/locations/[id]/fields/new` — Field Creation Wizard

**Step 1: Basic Info**
- Name, sport category dropdown (**Req #16**), description, cover image

**Step 2: Attributes** (**Req #6**)
- Environment: indoor/outdoor/covered (radio)
- Surface type: dropdown
- Has lighting: toggle
- Has changing rooms: toggle
- Has parking: toggle
- Has café/bar: toggle
- Has equipment rental: toggle
- Has fitness area: toggle
- Size: text input (e.g., "40x20m")
- Max players: number
- Game format: text (e.g., "5x5", "6x6")
- "Add Custom Attribute" for extras (key + value)

**Step 3: Booking Settings** (**Req #5**)
- Slot duration: dropdown (30, 60, 90, 120 min)
- Buffer between bookings: number (minutes)
- Price per slot EUR: number
- Price per slot local: number (auto-calculated or manual)
- Minimum booking notice: number (hours)
- Maximum advance booking: number (days)
- Auto-confirm: toggle
- Cancellation policy: number (hours before)

**Step 4: Availability** (**Req #5**)
- Default: inherits location schedule
- Per-day overrides: custom start/end for each day of week
- Date-specific blocks: calendar to mark specific dates as unavailable with reason

**Step 5: Review & Create**

### `/dashboard/locations/[id]/fields/[fieldId]` — Field Detail

**Tabs:** Settings, Attributes, Availability, Bookings, Sessions

Each tab is an editable form matching the wizard steps. The Bookings tab shows a mini calendar/list of bookings for this specific field.

## Page: `/dashboard/bookings`

**Requirement: Overall Bookings filtered by location.**

- **Filters**: Location (uses top-bar dropdown), date range, status, field, search by client name
- **View toggle**: Table view / Calendar view
- **Table**: Date, Time, Field, Location, Client, Status badge, Price, Actions (cancel, mark complete)
- **Calendar**: Weekly grid, bookings as colored blocks per field
- **"Manual Booking" button**: admin selects location → field → date → slot → client (search or walk-in) → create

## Page: `/dashboard/group-sessions`

Fully implemented management page for club admins to oversee all group sessions.

- List of sessions across all club locations (for the active/impersonated club)
- **Filters**: location, sport, date range, status (Draft/Active/Completed/Cancelled/Expired), visibility (Public/Private)
- **Table columns**: Title, Field, Location, Date/Time, Organizer, Participants (current/max), Visibility badge, Status badge, Pending requests count
- **Actions per row**: "View Detail" (→ public session detail page), "Cancel Session" (sets `cancelled_reason = 'manual'`)
- Status badge colors: Draft (yellow), Active (green), Completed (blue), Cancelled (red), Expired (gray)

## Page: `/dashboard/team`

**Requirement #2: 3 levels — admin, staff, trainers.**

- Table: Name, Email, Role (color-coded badge), Joined date, Active toggle
- Role dropdown per member to change role
- Remove member button (with confirmation)
- **"Invite Member" button** → modal: email, role (club_admin / staff / trainer), "Send Invite"

## Page: `/dashboard/settings`

- Club name, description, logo upload, cover image, website, email, phone
- Slug (read-only)
- Danger zone: deactivate club

---

# 9. PUBLIC PAGES (CLIENT-FACING)

Route group: `(public)` — accessible to everyone. Some actions require auth.

## Persistent UI: Sport Icon Bar

At the very top of every public page — horizontal strip of sport category icons. Clicking one navigates to `/sports/[slug]`. Active sport is highlighted. This mirrors Click&Play's top icon navigation.

```tsx
// Fetched once in layout, rendered as a horizontal scrollable bar
// Active state determined by current route
```

## Persistent UI: Main Navigation

Below the sport bar:
- Logo: "Sportly" (or "Sportly **Football**" when a sport is active)
- Links: Clubs, Players, News, Create Your Club
- Auth: Login | Register | Language switcher

---

## Page: `/` (Landing)

- **Hero**: Big image, headline, subtitle, inline search bar (city dropdown, field type, date/time picker)
- **Stats**: "39,382 Players" + "225,770 Reservations" counters (animated on scroll)
- **Sport Categories Grid**: large cards for each sport with icon, name, field count
- **New Clubs Carousel**: horizontal scrollable cards (club name, city, cover image, attribute icons)
- **Registered Players**: list of recently joined players with avatars
- **News** (optional for MVP)

## Page: `/sports/[category]` (Sport Landing)

- Sport icon bar: this sport highlighted
- **Themed hero** (color from `sport_categories.color_primary`): different background per sport
- Logo changes: "Sportly **Padel**"
- Same search bar, stats filtered to this sport
- New clubs carousel filtered to this sport
- "View All Clubs" → `/sports/[category]/clubs`

## Page: `/sports/[category]/clubs` (Club Listing)

**Requirement #13: Resources listed under sport category.**

- **Filter bar**: City dropdown, Field type dropdown, Date & time picker
- **Club list** (one row per club):
  ```
  [Logo] | Club Name                    | Prices from:                  | [Reserve →]
         | City, full address           | 50.00 € / 97.79 лв / 60 min  |
  ```
- Price shows cheapest field for this sport at this club
- Clubs with price range: "30.68 – 56.24 € / 60.00 – 110.00 лв / 60 min"
- Click club name or Reserve → `/clubs/[clubSlug]`

## Page: `/clubs/[clubSlug]` (Club Detail)

**The main public-facing club page. This is where booking happens.**

**Breadcrumb**: Home > Clubs > [Club Name]

**Location picker** (if club has multiple locations): button group or dropdown above tabs.

**Title**: "[Club Name]"
**Subtitle** (on schedule tab): "Reserve a pitch at [Club Name]"

**Tabs**:

### Tab 1: About Club (За клуба)
Two columns:
- Left: cover image, city, address, phone
- Right:
  - Field summary icons: "0 Indoor, 2 Lighting" (aggregated counts)
  - Surface info: "Artificial turf (2)"
  - Photo gallery (horizontal scrollable)
  - Amenity icons: Lighting, Changing Rooms/Showers, Café/Bar, Parking, Equipment Rental
  - Description (rich text)
  - "Reserve" button → switches to Daily Schedule tab

### Tab 2: Daily Schedule (Дневен график) — **DEFAULT TAB**
This is the core booking UI. See [Section 10](#10-daily-schedule-grid-core-booking-ui) for full specification.

### Tab 3: Weekly Schedule (Седмичен график)
- 7 columns (Mon–Sun), time rows
- Color-coded cells: available / booked / closed
- High-level overview, click a cell → jumps to daily schedule for that day

### Tab 4: Trainers (Треньори)
- Cards: photo, name, bio, sports, contact

---

## Page: `/sessions` (Public Group Sessions)

**Requirement #9: public/private. #18: book directly or create group sessions.**

- Shows **public** sessions only (both draft and confirmed, NOT cancelled/expired)
- Filter: sport, city, date range, skill level range
- Session cards: title, sport badge, field/club/location, date/time, organizer avatar, participant bar (5/10), price, **status badge** (Draft/Active), "Request to Join" button
- Click title → `/sessions/[id]`

## Page: `/sessions/[id]` (Session Detail)

- **Status banner** at top: Draft (yellow), Active (green), Completed (blue), Cancelled (red), Expired (gray)
  - Computed via `getSessionStatus()` helper from `is_confirmed`, `is_cancelled`, `cancelled_reason`, `completed_at`
- Full session info: title, description, field, location (with map), date/time
- Organizer profile card
- Participant list (avatars + names + ranking badges + status: confirmed/requested/waitlisted)
- Spots counter: "3 spots remaining"
- **Skill level range**: "Recommended: 3.0–5.0 rating"
- **Actions (vary by role and status)**:
  - **Any user on public session**: "Request to Join" (if not cancelled, spots available, meets skill range)
  - **Participant**: "Leave" (if already confirmed, not organizer)
  - **Organizer on draft session**: "Confirm Session" (reserves slot), "Edit", "Cancel"
  - **Organizer on active session**: "Edit", "Cancel", "Invite Players", "Share Link", "Mark Complete"
  - **Organizer — pending join requests section**: List of users with `status = 'requested'`, with "Approve" / "Decline" buttons for each
- **After session completed**: "Rate Players" section appears (see Section 13) — no time limit

## Page: `/sessions/new` (Create Group Session)

- Step 1: Pick sport category
- Step 2: Pick field (search or browse)
- Step 3: Pick date + slot — shows **all slots** (booked ones greyed out, blocked greyed out). Available slots show price + session badge count. User can only select available slots.
- Step 4: Session details: title, description, max participants, public/private, price per person, skill level range (min/max)
- Step 5: Review — clear message: "This creates a **draft** session. The slot is NOT reserved until you confirm the session. Confirm before the deadline to reserve."
- Confirm → creates **draft** session only (no booking) → redirects to `/sessions/[id]` detail page
- The slot API endpoint returns all slots (not just available), so the wizard shows a complete view of availability

## Page: `/players` (Player Listings)

**Requirement #19: rankings. #20: rate each other.**

- Search by name
- Filter by sport, city, ranking range
- **Leaderboard view**: top-rated players per sport
- Player cards: avatar, name, sport rankings (stars + number), games played
- Click → `/players/[id]`

## Page: `/players/[id]` (Player Profile)

- Avatar, name, city, member since
- **Rankings per sport** (Req #19):
  ```
  ⚽ Football:  ★★★★☆  4.2 (47 ratings, 120 sessions)
  🏓 Padel:     ★★★☆☆  3.8 (12 ratings, 28 sessions)
  🎾 Tennis:    ★★★★★  4.9 (8 ratings, 15 sessions)
  ```
- **Recent sessions** played
- **Rating breakdown**: average by criteria (Skill, Sportsmanship, Teamwork, Punctuality)
- **Recent ratings received** (anonymized or named, configurable)

---

## Page: `/my` (Client Dashboard)

Requires auth. Tab navigation: Bookings, Sessions, Rankings, Profile.

### `/my/bookings`
- Tabs: Upcoming | Past
- Each: field name, club, location, date/time, status badge, price
- If `booking.session_id` is set, show "View Session" link
- Actions: Cancel (within policy), Rebook (same field)

### `/my/sessions`
- Tabs: Upcoming | Past | My Invites (pending invites)
- Each: session title, field, date, role (organizer/participant), **status badge** (Draft/Active/Completed/Cancelled/Expired)
- **Organizer-specific for draft sessions:** Inline "Confirm" button + badge showing pending join request count
- Past sessions: "Rate Players" button (if not yet rated, no time limit)

### `/my/rankings` (**Requirement #19**)
- Per-sport ranking cards:
  ```
  ⚽ Football
  Rating: ★★★★☆ 4.2 / 5
  Based on 47 ratings from 120 sessions
  Skill: 4.5 | Sportsmanship: 4.0 | Teamwork: 4.1 | Punctuality: 4.3
  ```
- Trend chart: rating over time per sport
- "View all ratings" → list of individual ratings received (with/without rater name)
- Position in leaderboard: "You're #42 out of 3,200 Football players"

### `/my/profile`
- Edit: full name, avatar, phone, city
- Email (read-only)
- Change password
- Notification preferences (future)

---

# 10. DAILY SCHEDULE GRID (CORE BOOKING UI)

This is the most critical component. It lives inside the club detail page's "Daily Schedule" tab and is the primary way users book fields.

## Component: `src/components/booking/DailyScheduleGrid.tsx`

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [◀ 05.03.2026 ▶]  [Surface ▼]  [Indoor/Outdoor ▼]  [Lighting ▼]  │
├──────┬─────────────────────┬─────────────────────┬──────────────────┤
│      │        1            │        2            │        3         │
│      │  /Artificial turf/  │  /Artificial turf/  │  /Natural grass/ │
│      │  🔦 Lit  🌳 Outdoor │  🔦 Lit  🌳 Outdoor │  🌳 Outdoor     │
├──────┼─────────────────────┼─────────────────────┼──────────────────┤
│07:00 │ 50.00€ / 97.79лв   │ 50.00€ / 97.79лв   │ 40.00€ / 78.23лв│
│      │ 60 min              │ 60 min              │ 60 min           │
├──────┼─────────────────────┼─────────────────────┼──────────────────┤
│08:00 │ 50.00€ / 97.79лв   │ █████████████████   │ 40.00€ / 78.23лв│
│      │ 60 min              │ ████ BOOKED █████   │ 60 min           │
├──────┼─────────────────────┼─────────────────────┼──────────────────┤
│ ...  │ ...                 │ ...                 │ ...              │
├──────┼─────────────────────┼─────────────────────┼──────────────────┤
│15:00 │ █████████████████   │ █████████████████   │ █████████████████│
│16:00 │ █████████████████   │ █████████████████   │ █████████████████│
│ ...  │ (BOOKED BLOCKS)     │ (BOOKED BLOCKS)     │ (BOOKED BLOCKS)  │
├──────┼─────────────────────┼─────────────────────┼──────────────────┤
│21:00 │ 50.00€ / 97.79лв   │ 50.00€ / 97.79лв   │ ░░░ CLOSED ░░░  │
│22:00 │ ░░░░ CLOSED ░░░░   │ ░░░░ CLOSED ░░░░   │ ░░░ CLOSED ░░░  │
└──────┴─────────────────────┴─────────────────────┴──────────────────┘
```

### Slot Cell States

| State | Visual | Click |
|---|---|---|
| `available` (no sessions) | White bg, price in EUR + local, duration text | Opens booking modal (Tab 1 selected) |
| `available` (with sessions) | White bg, price + badge "📋 N sessions" | Opens booking modal (both tabs available) |
| `booked` | Solid green/sport-color block, "Booked" label | Nothing (or show "Booked" tooltip) |
| `blocked` | Light red bg, "Blocked" text | Nothing |
| `past` | Gray bg, dimmed | Nothing |

> **Session badge on available slots:** When `slot.sessions.length > 0`, the slot cell shows the regular booking price **plus** a small badge like "📋 2 sessions" indicating how many public group sessions are available to join on that time slot. The entire cell is still clickable and opens the 2-tab booking modal.
| `closed` | Empty gray cell | Nothing |

### Filter Dropdowns
Client-side filtering of which field columns are visible:
- **Surface**: all, artificial_turf, grass, clay, hard_court, ...
- **Indoor/Outdoor**: all, indoor, outdoor, covered
- **Lighting**: all, yes, no

### Date Navigation
- Left/right arrows to go day by day
- Click the date → calendar popover
- Cannot go before today
- Cannot go beyond `max(field.max_booking_advance_days)`

### Server Action: `getScheduleForDate`

```ts
// src/lib/actions/schedule-actions.ts
'use server'

export async function getScheduleForDate(
  locationId: string,
  date: string  // YYYY-MM-DD
): Promise<{
  field: { id, name, slug, sportCategory, attributes: Record<string,string> }
  bookingSettings: { slotDurationMinutes, pricePerSlotEur, pricePerSlotLocal, currency }
  slots: { startTime, endTime, status, priceEur, priceLocal }[]
}[]>
```

### Responsive Design

- **Desktop (≥1024px)**: all field columns visible side by side
- **Tablet (768–1023px)**: 2-3 columns, horizontal scroll
- **Mobile (<768px)**: ONE field at a time. Field selector dropdown above the slot list. Swipe or use dropdown to switch fields.

### Booking Modal (on slot click)

When user clicks an available slot, show a `<Dialog>` with **two tabs**: "Book Directly" and "Join Session".

**Tab 1: Book Directly** — Create a regular booking or a draft group session.

```
┌──────────────────────────────────────────────────┐
│ Book Slot                                        │
├──────────────────────────────────────────────────┤
│ [📅 Book Directly]    [👥 Join Session (3)]      │
├──────────────────────────────────────────────────┤
│ Pitch 1 — Arena Rakovski                        │
│ Sofia, ul. Balsha 18                            │
│                                                  │
│ Date:     05.03.2026                            │
│ Time:     09:00 — 10:00                         │
│ Duration: 60 min                                │
│ Price:    50.00 € / 97.79 лв                   │
│                                                  │
│ Notes: [________________]                       │
│                                                  │
│ ☐ Create a group session (draft)                │
│   (slot is NOT reserved until you confirm)      │
│                                                  │
│ [Cancel]               [Book Now — 50.00 €]     │
└──────────────────────────────────────────────────┘
```

If "Create a group session" is checked, the form expands and the button label changes:
- Title, description
- Public/Private radio
- Max participants (number)
- Price per person (EUR)
- Skill level range (min/max sliders, 0-5)
- Button becomes: **[Create Draft Session]**

On "Book Now" → creates confirmed booking → slot turns green → success toast.
On "Create Draft Session" → creates draft session only (no booking yet) → redirects to session detail page.

**Tab 2: Join Session** — Lists all public sessions (draft or confirmed) available on this slot.

```
┌──────────────────────────────────────────────────┐
│ Book Slot                                        │
├──────────────────────────────────────────────────┤
│ [📅 Book Directly]    [👥 Join Session (3)]      │
├──────────────────────────────────────────────────┤
│                                                  │
│ 🏐 Friday Volleyball ─ 3/8 players              │
│     Organizer: John D. │ Draft                   │
│     Skill: 2.0 - 4.0   │ Free                   │
│     [Request to Join]                            │
│                                                  │
│ ⚽ Morning Football ─ 7/10 players              │
│     Organizer: Maria K. │ Active                 │
│     Skill: Any          │ €5/person              │
│     [Request to Join]                            │
│                                                  │
│ 🎾 Casual Tennis ─ 2/4 players                  │
│     Organizer: Alex P.  │ Draft                  │
│     Skill: 1.0 - 3.0   │ €3/person              │
│     [Request to Join]                            │
│                                                  │
│ [Cancel]                                         │
└──────────────────────────────────────────────────┘
```

The tab badge "(3)" shows the number of joinable public sessions on this slot.
"Request to Join" → creates a `session_participants` row with `status = 'requested'` → toast "Join request sent!" → organizer sees the request on the session detail page.

### Realtime Updates (Supabase Realtime) — REQUIRED

Subscribe to **both** `bookings` and `group_sessions` tables so the grid stays live for all users.

```ts
const channel = supabase.channel('schedule')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'bookings',
    filter: `field_id=in.(${fieldIds.join(',')})`,
  }, () => refreshSchedule())
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'group_sessions',
    filter: `field_id=in.(${fieldIds.join(',')})`,
  }, () => refreshSchedule())
  .subscribe();

// Cleanup on unmount
return () => { supabase.removeChannel(channel); };
```

When User A books a slot, User B sees it turn green in real-time. When a draft session is created, cancelled, or confirmed, the slot grid updates for all viewers.

---

# 11. BOOKING SYSTEM LOGIC

## Slot Generation (computed, NOT stored)

```
function getAvailableSlots(fieldId, date):
  1. Get location schedule for this day_of_week
     → If is_closed, return empty
     → Get open_time, close_time

  2. Get field booking settings
     → slot_duration, buffer, min_notice, max_advance, price

  3. Validate booking window
     → If date > today + max_advance_days → return empty
     → If date is today → earliest slot = now + min_notice_hours

  4. Get field availability overrides
     → Weekly rules (day_of_week match)
     → Date-specific overrides (override weekly rules)
     → Build available time ranges

  5. Generate slot grid
     → From open_time to close_time, step by (duration + buffer)
     → Mark slots outside available ranges as blocked

  6. Fetch existing CONFIRMED bookings for field+date (status = 'confirmed')
     → Mark overlapping slots as booked (range overlap: start_time < slot.endTime AND end_time > slot.startTime)

  7. Mark past slots (for today)

  8. Fetch public group sessions for field+date (not cancelled)
     → Filter out sessions past confirmation_deadline (safety check)
     → Attach matching sessions[] to each overlapping slot

  9. Return array of TimeSlot
```

### TimeSlot Interface

```ts
interface SlotSession {
  id: string;
  title: string;
  organizerName: string;
  visibility: 'public' | 'private';
  isConfirmed: boolean;
  currentParticipants: number;
  maxParticipants: number;
  pricePerPersonEur: number;
  skillLevelMin: number;
  skillLevelMax: number;
  sportCategoryName: string;
  sportCategoryIcon: string;
}

interface TimeSlot {
  startTime: string;     // "09:00"
  endTime: string;       // "10:00"
  status: 'available' | 'booked' | 'blocked' | 'past';
  priceEur: number;
  priceLocal: number;
  bookingId?: string;    // if status === 'booked'
  sessions: SlotSession[];  // public sessions overlapping this slot (empty array if none)
}
```

> **Only `confirmed` bookings block slots.** Draft sessions do NOT reserve the slot. The slot remains `available` for regular bookings even if draft sessions exist on it. The `sessions[]` array lets the UI show how many public sessions are available for joining.

## Server Actions (`lib/actions/booking-actions.ts`)

```ts
'use server'

export async function createPublicBooking(data: {
  fieldId: string, date: string, startTime: string, endTime: string, notes?: string
}) {
  // 1. Auth check
  // 2. Get price from booking settings
  // 3. Validate booking window (min_notice_hours, max_advance_days)
  // 4. Call create_booking_safe() — always inserts with status = 'confirmed'
  //    (range overlap check inside the function prevents double bookings)
  // 5. Trigger: cancel_draft_sessions_on_booking fires automatically
  // 6. Return booking
}

export async function cancelBooking(bookingId: string) {
  // 1. Auth: own booking or club admin
  // 2. Check cancellation policy (hours before)
  // 3. Set status = 'cancelled'
  // 4. If linked to session (session_id IS NOT NULL):
  //    → Set group_sessions.is_cancelled = true, cancelled_reason = 'manual'
  //    → Clear group_sessions.booking_id
}

export async function createManualBooking(data: {
  fieldId, date, startTime, endTime, clientUserId?, walkInName?, notes?
}) {
  // Club admin creates booking on behalf of a client or walk-in
  // Uses create_booking_safe() — always confirmed
}
```

## Race Condition Prevention

The unique index prevents double bookings at the DB level:
```sql
CREATE UNIQUE INDEX idx_bookings_no_overlap
  ON bookings (field_id, date, start_time) WHERE status NOT IN ('cancelled');
```

Additionally, use a Postgres function for atomic check-and-insert with **time range overlap** detection:

```sql
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_field_id UUID, p_user_id UUID, p_date DATE,
  p_start_time TIME, p_end_time TIME,
  p_price_eur DECIMAL, p_price_local DECIMAL,
  p_session_id UUID DEFAULT NULL,
  p_booked_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  -- Lock the field row to prevent concurrent bookings
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
    total_price_eur, total_price_local, status,
    session_id, booked_by, notes
  ) VALUES (
    p_field_id, p_user_id, p_date, p_start_time, p_end_time,
    p_price_eur, p_price_local, 'confirmed',
    p_session_id, p_booked_by, p_notes
  ) RETURNING id INTO v_id;

  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

> **Key improvement:** The overlap check uses `start_time < p_end_time AND end_time > p_start_time` instead of exact `start_time` matching. This correctly detects overlapping bookings even when slot durations differ. The function also accepts optional `p_session_id` so that session bookings can be bidirectionally linked at creation time.

---

# 12. GROUP SESSIONS SYSTEM

**Requirements #9, #10, #18: Private/public sessions on fields, create and invite people.**

## Session Lifecycle

```
                          ┌───────────────────┐
                          │      DRAFT        │
                          │ is_confirmed=false │
                          │ booking_id=NULL    │
                          └─────┬──────┬──────┘
                                │      │
               Organizer clicks │      │ Slot booked by
               "Confirm"        │      │ another user
                                │      │ (trigger fires)
                                ▼      │
            ┌───────────────────┐      │      ┌───────────────────┐
            │      ACTIVE       │      └─────▶│    CANCELLED      │
            │ is_confirmed=true │             │ cancelled_reason  │
            │ booking_id=<uuid> │             │ = 'slot_taken'    │
            └───────┬───────────┘             └───────────────────┘
                    │                                  ▲
                    │ Organizer marks                   │ Organizer cancels
                    │ complete                          │ (cancelled_reason='manual')
                    │                                  │
                    ▼                         ─────────┘
            ┌───────────────────┐
            │    COMPLETED      │      ┌───────────────────┐
            │ completed_at set  │      │     EXPIRED       │
            └───────────────────┘      │ cancelled_reason  │
                    │                  │ = 'deadline_      │
                    │                  │    expired'       │
                    ▼                  └───────────────────┘
            Rating window opens               ▲
            (no time limit)                   │ pg_cron auto-cancel
                                              │ (confirmation_deadline < now())
```

### Lifecycle Rules

1. **Draft → Active (Confirm):** Organizer calls `confirmGroupSession`. This calls `create_booking_safe()` to reserve the slot. If successful, sets `is_confirmed = true`, stores `booking_id`, and sets `bookings.session_id` bidirectionally. If the slot is already taken, returns an error.

2. **Draft → Cancelled (slot_taken):** When a regular booking is inserted on the same field+date+time, the `cancel_draft_sessions_on_booking` trigger fires and cancels all overlapping unconfirmed sessions.

3. **Draft → Expired (deadline_expired):** `pg_cron` runs `auto_cancel_expired_sessions()` every 15 minutes. Any session where `confirmation_deadline < now()` and `is_confirmed = false` is cancelled. The `confirmation_deadline` is set to `start_time - 2 hours` at creation time.

4. **Active → Completed:** Organizer calls `markSessionComplete`. Sets `completed_at = now()`. Rating window opens with no time limit.

5. **Active → Cancelled (manual):** Organizer calls `cancelSession`. Sets `is_cancelled = true, cancelled_reason = 'manual'`. The linked booking is also cancelled (`status = 'cancelled'`).

### Visibility Rules

- **Public sessions** (draft or confirmed, not cancelled): visible in `/sessions` listing, visible on slot grid as badges, anyone can request to join.
- **Private sessions**: visible only to organizer and participants. Not shown on slot grid or public listings.

## Server Actions (`lib/actions/session-actions.ts`)

```ts
'use server'

export async function createGroupSession(data: {
  fieldId: string, date: string, startTime: string, endTime: string,
  title: string, description?: string, visibility: 'public' | 'private',
  maxParticipants: number, pricePerPersonEur?: number,
  skillLevelMin?: number, skillLevelMax?: number
}) {
  // 1. Auth check
  // 2. Compute confirmation_deadline = date + startTime - 2 hours
  // 3. Insert group_session with is_confirmed=false, booking_id=NULL
  // 4. Add organizer as participant (status: confirmed)
  // 5. Return session (redirect to detail page)
  // NOTE: No booking is created yet. Slot is NOT reserved.
}

export async function confirmGroupSession(sessionId: string) {
  // 1. Auth: must be organizer
  // 2. Verify session is draft (is_confirmed=false, is_cancelled=false)
  // 3. Get session's field_id, date, start_time, end_time, price info
  // 4. Call create_booking_safe() to atomically reserve the slot
  //    Pass session_id so booking.session_id is set
  // 5. Update group_sessions: is_confirmed=true, booking_id=<new booking id>
  // 6. Return success (or SLOT_ALREADY_BOOKED error)
}

export async function editGroupSession(sessionId: string, data: {
  title?: string, description?: string, maxParticipants?: number,
  pricePerPersonEur?: number, skillLevelMin?: number, skillLevelMax?: number
}) {
  // 1. Auth: must be organizer
  // 2. Verify session is not cancelled or completed
  // 3. Cannot change: fieldId, date, startTime, endTime, visibility
  // 4. Update allowed fields
  // 5. Return updated session
}

export async function requestToJoinSession(sessionId: string) {
  // 1. Auth check
  // 2. Verify: session is public, not cancelled, not full
  // 3. Verify: user meets skill range
  // 4. Verify: user is not already a participant
  // 5. Insert session_participants with status = 'requested'
  // 6. Return success → organizer sees pending request
}

export async function approveJoinRequest(sessionId: string, userId: string) {
  // 1. Auth: must be organizer
  // 2. Verify: participant status = 'requested'
  // 3. If session is full → optionally waitlist, or reject
  // 4. Update participant status to 'confirmed'
  // 5. Trigger increments current_participants
}

export async function declineJoinRequest(sessionId: string, userId: string) {
  // 1. Auth: must be organizer
  // 2. Update participant status to 'declined'
}

export async function leaveSession(sessionId: string) {
  // 1. Auth check (cannot be organizer)
  // 2. Remove participant record
  // 3. Trigger decrements count
  // 4. Promote first waitlisted person to confirmed
}

export async function inviteToSession(sessionId: string, data: {
  userIds?: string[], emails?: string[], generateLink?: boolean
}) {
  // 1. Verify organizer
  // 2. Create session_invites records
  // 3. If generateLink → create invite with invite_code
}

export async function acceptInvite(inviteCode: string) {
  // 1. Look up invite by code
  // 2. Add user as participant with status = 'confirmed' (auto-confirm)
  // 3. Mark invite as accepted
}

export async function cancelSession(sessionId: string) {
  // 1. Auth: organizer or club admin
  // 2. Set is_cancelled = true, cancelled_reason = 'manual'
  // 3. If is_confirmed = true and booking_id exists:
  //    → Set booking status = 'cancelled'
}

export async function markSessionComplete(sessionId: string) {
  // 1. Verify organizer or club admin
  // 2. Verify session is confirmed (is_confirmed = true)
  // 3. Set completed_at = now()
  // 4. Increment total_sessions_played in user_sport_rankings for each confirmed participant
  // 5. Rating window is now open (no time limit)
}
```

## Join / Request Flow Summary

| Session visibility | Action | Result |
|---|---|---|
| **Public** | User clicks "Request to Join" | `session_participants` row with `status = 'requested'` |
| **Public** | Organizer approves request | `status → 'confirmed'`, `current_participants` incremented |
| **Public** | Organizer declines request | `status → 'declined'` |
| **Private** | Organizer sends invite | `session_invites` row created |
| **Private** | User accepts invite | `session_participants` row with `status = 'confirmed'` (auto-confirm) |
| **Any** | Session is full | New requests/accepts → `status = 'waitlisted'` |
| **Any** | Confirmed participant leaves | First `waitlisted` promoted to `confirmed` |

---

# 13. RANKING & RATING SYSTEM

**Requirement #19: Each public user has ranking per sport.**
**Requirement #20: Users can rate each other if played together in group session.**

## How It Works

### Who Can Rate Whom

- You can ONLY rate someone if:
  1. You were BOTH confirmed participants in the SAME group session
  2. The session is marked as COMPLETED (`completed_at IS NOT NULL`)
  3. You haven't already rated them for this session
  4. You're not rating yourself
  5. **No time limit** — you can rate at any point after session completion

### Rating Flow

1. User goes to `/my/sessions` → sees past completed sessions
2. Clicks "Rate Players" on a completed session
3. Sees list of other participants in that session
4. For each participant, can submit:
   - **Overall rating**: 1–5 stars (required)
   - **Skill**: 1–5 (optional)
   - **Sportsmanship**: 1–5 (optional)
   - **Teamwork**: 1–5 (optional)
   - **Punctuality**: 1–5 (optional)
   - **Comment**: freeform text (optional)
5. Submit → `user_ratings` rows created → trigger updates `user_sport_rankings`

### Rating Calculation

The `user_sport_rankings.rating` is the **weighted average** of all ratings received for that sport:

```sql
rating = (
  SUM(overall_rating * 1.0 + skill_rating * 1.0 + sportsmanship * 1.0 + teamwork * 0.8 + punctuality * 0.5)
  / SUM(weights_of_non_null_criteria)
)
```

Simplified for MVP: just average of `user_ratings.rating` (the overall star rating).

### User Sport Rankings Display

```
User Profile:
┌──────────────────────────────────────────┐
│ ⚽ Football                              │
│ ★★★★☆  4.2 / 5.0                       │
│ 47 ratings · 120 sessions played         │
│ #42 of 3,200 players                    │
│                                          │
│ Skill: 4.5  Sportsmanship: 4.0          │
│ Teamwork: 4.1  Punctuality: 4.3         │
├──────────────────────────────────────────┤
│ 🏓 Padel                                │
│ ★★★☆☆  3.8 / 5.0                       │
│ 12 ratings · 28 sessions played          │
│ #89 of 1,150 players                    │
└──────────────────────────────────────────┘
```

### Leaderboard (`/players`)

- Default: all sports combined (average across sports? or separate tabs)
- Per-sport leaderboards (tab or dropdown)
- Top 100 shown, with search to find any player
- Shows: rank, avatar, name, rating, sessions played
- Click → player profile

### Rating Server Actions

```ts
'use server'

export async function ratePlayer(data: {
  sessionId: string
  ratedUserId: string
  rating: number          // 1-5 overall
  skillRating?: number
  sportsmanshipRating?: number
  teamworkRating?: number
  punctualityRating?: number
  comment?: string
}) {
  // 1. Auth check
  // 2. Verify both rater and rated were participants in session
  // 3. Verify session is completed
  // 4. Verify not already rated
  // 5. Verify not self-rating
  // 6. Get sport_category_id from session
  // 7. Insert user_ratings
  // 8. Trigger auto-updates user_sport_rankings
}

export async function getPlayerRankings(userId: string) {
  // Returns all sport rankings for a user with breakdown
}

export async function getLeaderboard(sportCategoryId: string, options: {
  limit?: number, offset?: number, city?: string
}) {
  // Returns ranked list of players for a sport
}

export async function getSessionRatings(sessionId: string) {
  // For a user: get who they can still rate, and ratings they've already given
}
```

### Safeguards

- **Minimum ratings to display**: Don't show a public ranking until user has at least 3 ratings (prevent gaming)
- **Rate limiting**: Can only submit ratings within 7 days of session completion
- **Report abuse**: Users can report unfair ratings (future)
- **Decay**: Old ratings could weigh less (future, configurable)

---

# 14. UI COMPONENTS & DESIGN SYSTEM

## shadcn/ui Base

Install all needed components upfront (listed in Section 2 setup).

## Custom Components

### Layout
- `AppShell` — sidebar + topbar + content wrapper
- `ImpersonationBanner` — yellow bar "Viewing as: [Club] | [Exit]"
- `LocationSelector` — combobox dropdown in dashboard top bar
- `ClubSelector` — combobox for admin impersonation
- `SportIconBar` — horizontal scrollable sport icon strip (top of public pages)

### Forms / Wizards
- `Wizard` — multi-step form with progress indicator, back/next, accumulated state
- `WeeklyScheduleEditor` — 7-row grid with day, closed toggle, open/close time pickers
- `AttributeEditor` — dynamic key-value form for field attributes
- `TimeRangePicker` — two time inputs with validation

### Booking
- `DailyScheduleGrid` — the core booking grid (Section 10), includes Supabase Realtime subscriptions
- `SlotCell` — individual slot in the grid, shows session badge if `slot.sessions.length > 0`
- `BookingModal` — 2-tab dialog: "Book Directly" (regular booking or draft session) + "Join Session" (list public sessions)
- `BookingCalendar` — weekly calendar view for admin dashboard

### Sessions
- `SessionCard` — card for session listings, renders status badge (Draft/Active/Completed/Cancelled/Expired)
- `ParticipantList` — avatars + names + status badges (including `requested` status)
- `InviteModal` — search users + generate invite link

### Ratings
- `RatingStars` — interactive 1-5 star input
- `RatingCard` — display a user's sport rating
- `RatePlayersForm` — form to rate multiple players after a session
- `LeaderboardTable` — ranked player list with sport filter
- `RankingBreakdown` — per-criteria bar chart

### Data Display
- `StatsCard` — dashboard overview card (icon, title, value, trend)
- `SportCategoryCard` — large card for landing page grid
- `ClubCard` — card for club listings (logo, name, address, price)
- `FieldCard` — card with attribute badges
- `PlayerCard` — avatar, name, ranking stars

## Colors

```ts
// tailwind.config.ts
extend: {
  colors: {
    brand: { 50: '#f0fdf4', 500: '#22c55e', 700: '#15803d', 900: '#14532d' },
    // Sport-specific colors are loaded dynamically from sport_categories table
  }
}
```

Each sport has a `color_primary` and `color_accent` in the database. Public pages use these dynamically via CSS custom properties:

```tsx
<div style={{ '--sport-primary': sport.color_primary, '--sport-accent': sport.color_accent }}>
```

## Multi-Currency Price Display

```ts
// src/lib/utils/price.ts
const BGN_EUR_RATE = 1.9558  // Fixed rate

export function formatDualPrice(eur: number, local?: number): string {
  const bgn = local ?? (eur * BGN_EUR_RATE)
  return `${eur.toFixed(2)} € / ${bgn.toFixed(2)} лв`
}
```

## Responsive Breakpoints

- Mobile-first
- `sm` (640px): minor adjustments
- `md` (768px): sidebar appears, 2-col grids
- `lg` (1024px): wider sidebar, 3-col grids, full schedule grid
- Sidebar: hamburger on mobile, fixed on desktop

## Loading & Empty States

Every list/grid needs:
- **Loading**: matching skeleton components
- **Empty**: illustration + message + CTA
  - "No locations yet. Add your first." → button
  - "No bookings yet."
  - "No public sessions. Create one!"
  - "No ratings yet. Play a session to start building your ranking!"

## Notifications

For MVP, notifications are **toast-based only** (shown on next page visit or after action). No in-app notification bell or email system.

Status updates the user sees on their next visit:
- Organizer: "You have N pending join requests" (on My Sessions page)
- Participant: Session status changes reflected in session cards (e.g., session cancelled badge)
- Auto-cancel results visible as "Expired" or "Cancelled" status badges

## Toasts

- Success: "Booking confirmed!", "Location created!", "Rating submitted!", "Session confirmed — slot reserved!", "Join request sent!", "Request approved!"
- Error: "Slot no longer available.", "Failed to create.", "Session expired — deadline passed.", "Cannot confirm — slot already booked."
- Info: "Added to waitlist.", "Draft session created — confirm before the deadline to reserve the slot.", "You have N pending join requests."

---

# 15. FILE & FOLDER STRUCTURE

```
src/
├── app/
│   ├── (auth)/
│   │   ├── auth/login/page.tsx
│   │   ├── auth/register/page.tsx
│   │   └── auth/callback/route.ts
│   ├── (public)/
│   │   ├── layout.tsx                          ← Public layout (sport bar + nav + footer)
│   │   ├── page.tsx                            ← Landing
│   │   ├── sports/[category]/
│   │   │   ├── page.tsx                        ← Sport landing
│   │   │   └── clubs/page.tsx                  ← Club listing for sport
│   │   ├── clubs/[clubSlug]/page.tsx           ← Club detail + booking
│   │   ├── sessions/
│   │   │   ├── page.tsx                        ← Browse sessions
│   │   │   ├── [id]/page.tsx                   ← Session detail
│   │   │   └── new/page.tsx                    ← Create session
│   │   ├── players/
│   │   │   ├── page.tsx                        ← Leaderboard
│   │   │   └── [id]/page.tsx                   ← Player profile
│   │   └── my/
│   │       ├── layout.tsx                      ← Client dashboard layout
│   │       ├── bookings/page.tsx
│   │       ├── sessions/page.tsx
│   │       ├── rankings/page.tsx
│   │       └── profile/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                          ← Dashboard layout (sidebar + impersonation)
│   │   ├── dashboard/page.tsx                  ← Overview
│   │   ├── dashboard/locations/
│   │   │   ├── page.tsx                        ← Location list
│   │   │   ├── new/page.tsx                    ← Create location wizard
│   │   │   └── [id]/
│   │   │       ├── page.tsx                    ← Location detail (tabs)
│   │   │       └── fields/
│   │   │           ├── new/page.tsx            ← Create field wizard
│   │   │           └── [fieldId]/page.tsx      ← Field detail (tabs)
│   │   ├── dashboard/bookings/page.tsx
│   │   ├── dashboard/group-sessions/page.tsx
│   │   ├── dashboard/team/page.tsx
│   │   └── dashboard/settings/page.tsx
│   └── (admin)/
│       ├── layout.tsx                          ← Admin layout
│       ├── admin/clubs/page.tsx
│       ├── admin/sport-categories/page.tsx
│       └── admin/users/page.tsx
├── components/
│   ├── ui/                                     ← shadcn/ui components
│   ├── layout/                                 ← AppShell, sidebars, banners
│   ├── forms/                                  ← Wizard, schedule editors
│   ├── booking/                                ← DailyScheduleGrid, SlotCell, BookingModal
│   ├── sessions/                               ← SessionCard, ParticipantList
│   └── ratings/                                ← RatingStars, RatePlayersForm, Leaderboard
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── auth/
│   │   ├── helpers.ts                          ← getCurrentUser, requireSuperAdmin, etc.
│   │   └── impersonation.ts                    ← setImpersonatedClub, getActiveClubId, etc.
│   ├── actions/
│   │   ├── admin-actions.ts                    ← Club/category/user management
│   │   ├── club-actions.ts                     ← Location/field CRUD
│   │   ├── booking-actions.ts                  ← Create/cancel bookings
│   │   ├── session-actions.ts                  ← Create/join/leave/invite sessions
│   │   ├── rating-actions.ts                   ← Rate players, get rankings
│   │   └── schedule-actions.ts                 ← getScheduleForDate, manage availability
│   ├── booking/
│   │   └── slot-generator.ts                   ← getAvailableSlots algorithm
│   ├── utils/
│   │   ├── price.ts                            ← formatDualPrice
│   │   ├── date.ts                             ← Date/time helpers
│   │   └── validation.ts                       ← Zod schemas
│   └── constants/
│       └── attributes.ts                       ← Standard field attribute keys/values
├── db/
│   ├── schema.ts                               ← Drizzle schema (all tables + enums)
│   └── migrations/                             ← Drizzle migration files
├── hooks/                                      ← Custom React hooks
├── types/                                      ← TypeScript interfaces
└── middleware.ts                                ← Auth middleware
```

---

# 16. IMPLEMENTATION PHASES

## Phase 1: Foundation
1. Clone Vercel SaaS Starter
2. Replace DB with Supabase (env vars, client files)
3. Create all tables, enums, triggers, indexes, RLS in Supabase
4. Set up Drizzle schema
5. Install + init shadcn/ui
6. Create route group structure (stub pages)
7. Seed sport categories + rating criteria
8. Manually create a super_admin user

## Phase 2: Auth & Layouts
1. Auth pages (login, register, callback)
2. Middleware (route protection)
3. AppShell, admin layout, dashboard layout, public layout
4. Impersonation system (cookies, helpers)
5. ClubSelector + LocationSelector dropdowns
6. ImpersonationBanner

## Phase 3: Super Admin
1. Sport categories CRUD page
2. Clubs management page + impersonation
3. Users management page

## Phase 4: Dashboard — Locations & Fields
1. Locations list page
2. Create Location wizard (4 steps)
3. Location detail page (tabs: info, fields, schedule)
4. Create Field wizard (5 steps)
5. Field detail page (tabs: settings, attributes, availability, bookings, sessions)

## Phase 5: Booking Engine
1. Slot generation algorithm (`getAvailableSlots`) with session attachment
2. `DailyScheduleGrid` component with session badges on available slots
3. 2-tab booking modal ("Book Directly" + "Join Session") + `createPublicBooking` server action
4. Regular bookings always `confirmed` (no pending state)
5. `create_booking_safe()` with range overlap check
6. Dashboard bookings page (table + calendar views, filters)
7. Public club detail page with daily schedule tab
8. `cancel_draft_sessions_on_booking` trigger for auto-cancelling drafts

## Phase 6: Public Pages
1. Landing page (hero, sport grid, new clubs carousel)
2. Sport landing page (themed)
3. Club listing page (filters, price display)
4. Club detail page (all 4 tabs: about, daily, weekly, trainers)
5. Client dashboard (/my pages)

## Phase 7: Group Sessions (Draft Lifecycle)
1. Create draft session flow (from booking modal + standalone wizard)
2. Session detail page with status banners (draft/active/completed/cancelled/expired)
3. Organizer actions: confirm session (reserves slot), edit, cancel
4. Request-to-join flow for public sessions (request → organizer approves/declines)
5. Invite system for private sessions (direct + link → auto-confirm on accept)
6. Browse sessions page (public sessions listing)
7. My Sessions page with inline confirm button and pending request badges
8. Dashboard group-sessions management page (club admin)
9. Session lifecycle (draft → active → completed, or draft → cancelled/expired)

## Phase 8: Rankings & Ratings
1. Rate players form (after session completion)
2. User sport rankings display (profile, /my/rankings)
3. Player profile page
4. Leaderboard page (/players)
5. Rating breakdown (per criteria)
6. Rating triggers and auto-calculation

## Phase 8b: Supabase Realtime (REQUIRED)
1. Realtime subscription on `bookings` table (by field_id) in `DailyScheduleGrid`
2. Realtime subscription on `group_sessions` table (by field_id) in `DailyScheduleGrid`
3. Auto-refresh schedule when changes detected
4. Cleanup subscription on component unmount

## Phase 8c: pg_cron Auto-Cancel
1. Deploy `auto_cancel_expired_sessions()` function
2. Schedule `cron.schedule('auto-cancel-expired-sessions', '*/15 * * * *', ...)`
3. Verify auto-cancellation with test data

## Phase 9: Polish
1. Loading skeletons + empty states everywhere
2. Toast notifications (including session-specific toasts)
3. Responsive design pass (especially schedule grid on mobile)
4. SEO (meta tags, Open Graph for public pages)
5. Performance (query optimization, pagination)
6. Image optimization (Supabase Storage + Next.js Image)

---

# 17. REQUIREMENTS TRACEABILITY

Every original requirement mapped to where it's implemented:

| # | Requirement | Database | Pages | Components |
|---|---|---|---|---|
| 1 | Create many Clubs | `clubs` | `/admin/clubs` | ClubSelector |
| 2 | Club has team with 3 roles (admin, staff, trainer) | `club_members` | `/dashboard/team` | — |
| 3 | Club has many locations | `locations` | `/dashboard/locations` | LocationSelector |
| 4 | Location has different sports / many fields per sport | `fields` + `sport_categories` | `/dashboard/locations/[id]/fields` | FieldCard |
| 5 | Field has different booking settings + availability | `field_booking_settings` + `field_availability` | Field wizard step 3+4, field detail tabs | WeeklyScheduleEditor |
| 6 | Field has attributes (lighting, fitness, indoor, size, pavement...) | `field_attributes` | Field wizard step 2, field detail | AttributeEditor |
| 7 | Location has daily/weekly schedule | `location_schedules` | Location wizard step 2, location schedule tab | WeeklyScheduleEditor |
| 8 | Location has own phone/address | `locations.phone`, `locations.address` | Location wizard step 1, club detail about tab | — |
| 9 | Group sessions: private or public | `group_sessions.visibility` | `/sessions`, session detail | SessionCard |
| 10 | Field may have group sessions | `group_sessions.field_id` | Field detail sessions tab, session pages | DailyScheduleGrid |
| 11 | Easy navigation: create/list locations in Sportly | Wizard pattern | `/dashboard/locations`, wizard | Wizard |
| 12 | Many sport categories (football, padel, tennis...) | `sport_categories` | `/admin/sport-categories`, sport icon bar | SportIconBar, SportCategoryCard |
| 13 | Resources listed under sport category | `fields.sport_category_id` | `/sports/[category]/clubs` | ClubCard |
| 14 | Super user impersonates companies | Impersonation cookies | `/admin/clubs` dropdown | ClubSelector, ImpersonationBanner |
| 15 | Super user creates sport categories | `sport_categories` | `/admin/sport-categories` | — |
| 16 | Companies select sport category for resources | `fields.sport_category_id` | Field wizard step 1 | — |
| 17 | Public users create accounts + book easily | `profiles`, `bookings` | `/auth/register`, `/clubs/[slug]` | DailyScheduleGrid, BookingModal |
| 18 | Public user: book directly OR create public/private sessions + invite | `bookings`, `group_sessions`, `session_invites`, `session_participants` | 2-tab BookingModal, `/sessions/new`, `/sessions/[id]`, invite flow | BookingModal (Book Directly + Join Session tabs), InviteModal, SessionCard |
| 19 | **Each public user has ranking PER SPORT** | **`user_sport_rankings`** | **`/my/rankings`, `/players/[id]`, `/players`** | **RatingCard, LeaderboardTable, RankingBreakdown** |
| 20 | **Users rate each other if played together** | **`user_ratings`, `user_rating_details`** | **`/my/sessions` → Rate Players, session detail** | **RatePlayersForm, RatingStars** |
| — | Dropdown to impersonate clubs | — | `/admin` top area | ClubSelector |
| — | Location dropdown in dashboard | — | Dashboard top bar | LocationSelector |
| — | Seamless setup in few steps | — | Location wizard, field wizard | Wizard |
| — | Draft session lifecycle + auto-cancel | `group_sessions.is_confirmed`, `confirmation_deadline`, `cancelled_reason` | `/sessions/[id]` (status banner), `/my/sessions` (confirm CTA) | SessionCard (status badge) |
| — | Request-to-join flow for public sessions | `session_participants.status = 'requested'` | `/sessions/[id]` (request button + approve/decline), booking modal "Join Session" tab | BookingModal Tab 2 |
| — | Supabase Realtime for live slot updates | `bookings`, `group_sessions` subscriptions | `DailyScheduleGrid` auto-refresh | — |
| — | pg_cron auto-cancel expired drafts | `auto_cancel_expired_sessions()` function | — | — |
| — | Dashboard group-sessions management | `group_sessions` queries | `/dashboard/group-sessions` | — |
| — | Supabase as database | All tables in Supabase | — | — |
| — | Vercel SaaS Starter template | — | — | — |

**All 20 requirements: ✅ COVERED.** Additional system features (draft lifecycle, request-to-join, realtime, auto-cancel) are listed above.
