---
name: Fix booking bugs
overview: "Foundation-first approach: update blueprint & guide docs, fix SQL schema, Drizzle schema, seed with full demo data, then implement all booking/session lifecycle fixes with extreme detail."
todos:
  - id: p1-blueprint
    content: "Phase 1: Update SPORTLY-BLUEPRINT.md - add draft session lifecycle, request-to-join flow, new participant statuses, new columns, updated create_booking_safe, new triggers, updated session lifecycle diagram"
    status: completed
  - id: p2-guide
    content: "Phase 2: Update SPORTLY-IMPLEMENTATION-GUIDE.md - update Phase 7 (booking engine), Phase 9 (group sessions), Phase 11 (realtime is NOT optional), add new server actions, update booking modal spec"
    status: completed
  - id: p3-sql-schema
    content: "Phase 3: Write SQL migration + update supabase-schema.sql with all new columns, enum values, triggers, functions"
    status: completed
  - id: p4-drizzle-schema
    content: "Phase 4: Sync lib/db/schema.ts with new DB columns and enum"
    status: completed
  - id: p5-seed
    content: "Phase 5: Write comprehensive lib/db/seed.sql with test auth users, clubs, locations, fields, bookings, sessions, ratings"
    status: completed
  - id: p6-queries
    content: "Phase 6: Populate lib/db/queries.ts with reusable typed query helpers"
    status: completed
  - id: p7-booking-actions
    content: "Phase 7: Fix booking-actions.ts - always confirmed, bidirectional session link"
    status: completed
  - id: p8-session-actions
    content: "Phase 8: Rewrite session-actions.ts - draft lifecycle, confirmGroupSession, editGroupSession, requestToJoinSession, approveJoinRequest, declineJoinRequest"
    status: completed
  - id: p9-slot-generator
    content: "Phase 9: Enhance slot-generator.ts - SlotSession metadata, range overlap, attach public sessions to slots"
    status: completed
  - id: p10-booking-modal
    content: "Phase 10: Redesign booking-modal.tsx with 2 tabs (Book Directly + Join Session), wire up draft session creation"
    status: completed
  - id: p11-slot-ui
    content: "Phase 11: Update slot-cell.tsx with session count badge, update daily-schedule-grid.tsx click handler"
    status: completed
  - id: p12-session-detail
    content: "Phase 12: Update session detail page - status badges, Confirm/Edit/Approve/Decline actions, request-to-join"
    status: completed
  - id: p13-my-pages
    content: "Phase 13: Update My Sessions (confirm CTA, request counts), My Bookings (session link), SessionCard (status badges)"
    status: completed
  - id: p14-dashboard-sessions
    content: "Phase 14: Implement dashboard group-sessions page with full listing and management"
    status: completed
  - id: p15-realtime
    content: "Phase 15: Add Supabase Realtime subscription in DailyScheduleGrid for bookings + group_sessions"
    status: completed
  - id: p16-wizard
    content: "Phase 16: Update new-session-wizard slot step - show all slots, booked greyed out, session indicators, draft messaging"
    status: completed
  - id: p17-auto-cancel
    content: "Phase 17: Set up pg_cron for auto-cancel + on-access safety filter in slot generator"
    status: completed
  - id: p18-validate
    content: "Phase 18: Validation checklist - test all 5 original bugs + new features end-to-end"
    status: completed
isProject: false
---

# Comprehensive Booking & Session System Fix

## Approach: Foundation First

We fix the documentation and data layer BEFORE touching application code. This ensures every code change has a clear source of truth.

```
Phase 1-2: Update docs (blueprint + implementation guide)
Phase 3-4: Fix database (SQL schema + Drizzle schema)
Phase 5-6: Fix data layer (seed + queries)
Phase 7-17: Code changes (actions, UI, realtime)
Phase 18: Validation
```

---

## PHASE 1: Update SPORTLY-BLUEPRINT.md

The blueprint is the source of truth. Every code decision traces back to it.

### 1a. Section 4 - Database Schema changes

**Add to Section 4.13 `group_sessions` table definition:**

Three new columns:

```sql
is_confirmed BOOLEAN DEFAULT false,
confirmation_deadline TIMESTAMPTZ,
cancelled_reason TEXT
-- CHECK (cancelled_reason IN ('manual', 'deadline_expired', 'slot_taken'))
```

**Add to the enums section:**

```sql
-- Update the enum definition:
CREATE TYPE session_participant_status AS ENUM (
  'invited', 'requested', 'confirmed', 'declined', 'waitlisted'
);
```

The new `requested` status is for public session join requests that need organizer approval.

### 1b. Section 11 - Booking System Logic changes

**Update `create_booking_safe` function to use range overlap:**

Replace exact `start_time` match with proper time range check:

```sql
-- BEFORE (only exact match):
AND start_time = p_start_time
-- AFTER (range overlap):
AND start_time < p_end_time
AND end_time > p_start_time
```

**Add rule: regular bookings always confirmed:**

> Regular bookings (not linked to a group session) are ALWAYS created with `status = 'confirmed'`. The `auto_confirm` setting is reserved for future use. There is no 'pending' state for regular bookings.

### 1c. Section 12 - Group Sessions System - MAJOR REWRITE

**Replace the entire Session Lifecycle with:**

```
DRAFT (created, no booking, slot not reserved)
  -> Organizer invites players (private) or session is publicly listed (public)
  -> Public users can REQUEST to join (status: 'requested')
  -> Private users can only join via invite (status: 'confirmed' on accept)
  -> Organizer approves/declines join requests
  -> Organizer CONFIRMS session -> booking created -> slot reserved
  -> If slot already taken -> confirmation fails, organizer picks new slot

ACTIVE (confirmed, booking exists, slot reserved)
  -> Participants join/leave (with organizer approval for public)
  -> Can be cancelled by organizer -> booking cancelled too

IN PROGRESS (during session time)
  -> No more joins

COMPLETED (after end time, marked by organizer)
  -> Rating window opens

CANCELLED (by organizer or auto)
  -> Reasons: 'manual', 'deadline_expired', 'slot_taken'

EXPIRED (auto-cancelled because confirmation_deadline passed)
  -> Special case of cancelled with reason 'deadline_expired'
```

**Replace session server actions spec with:**

```ts
// Creates a DRAFT session (no booking, is_confirmed=false)
createGroupSession(data)

// Organizer confirms: creates booking via create_booking_safe, sets is_confirmed=true
confirmGroupSession(sessionId)

// Organizer edits: title, description, maxParticipants, skillRange, price, visibility
// CANNOT edit: date, time, field (must cancel and recreate)
editGroupSession(sessionId, data)

// Public session: user sends request (status='requested')
requestToJoinSession(sessionId)

// Organizer approves request -> status='confirmed'
approveJoinRequest(sessionId, userId)

// Organizer declines request -> status='declined'
declineJoinRequest(sessionId, userId)

// Private session: invite accepted -> auto-join as 'confirmed'
acceptInvite(inviteCode)

// Leave session (not organizer)
leaveSession(sessionId)

// Organizer or club admin cancels
cancelSession(sessionId)

// Organizer marks complete after end time
markSessionComplete(sessionId)
```

**Add new subsection: "Auto-Cancellation Rules"**

> 1. `confirmation_deadline` is computed as `session_date + start_time - 2 hours`
> 2. A pg_cron job runs every 15 minutes to cancel unconfirmed sessions past their deadline (sets `is_cancelled = true`, `cancelled_reason = 'deadline_expired'`)
> 3. When a confirmed booking is inserted on a field/date/time, a trigger auto-cancels all overlapping draft sessions (sets `cancelled_reason = 'slot_taken'`)

**Add new subsection: "Session Join Flow"**

> **Public sessions:**
>
> - Anyone can see the session in the `/sessions` listing and on the slot grid
> - User clicks "Request to Join" -> participant row created with `status = 'requested'`
> - Organizer sees pending requests on session detail page
> - Organizer approves (-> `confirmed`) or declines (-> `declined`)
> - Organizer can also send direct invites (email or link)
>
> **Private sessions:**
>
> - Only visible to organizer and participants
> - Users can only join via invite from the organizer
> - Accepting invite auto-sets `status = 'confirmed'` (no approval step)

### 1d. Section 10 - Daily Schedule Grid changes

**Update booking modal spec:**

Replace the single-purpose modal with a 2-tab design:

```
Tab 1: "Book Directly"
  - Same as current: date, time, price, notes
  - "Create a group session" checkbox -> expands to draft session form
  - Button: "Confirm Booking" (regular) or "Create Draft Session" (if checkbox)

Tab 2: "Join Session" (only shown if slot has public sessions)
  - Lists all public draft/active sessions on this slot
  - Each shows: title, organizer, participants count, price
  - "Request to Join" button per session
  - "No sessions on this slot" if empty
```

**Update slot cell spec:**

Add new visual state for available slots with sessions:

```
Available slot WITH sessions:
  ┌─────────────────────┐
  │  50.00€ / 97.79лв   │
  │  60 min              │
  │  [2 sessions 📋]     │  <- badge showing public session count
  └─────────────────────┘
```

**Add Supabase Realtime as REQUIRED (not optional):**

Move from Section 14 (polish) to Section 10 (core). Listen to both `bookings` AND `group_sessions` tables.

### 1e. Section 5 - New Triggers

**Add trigger: cancel draft sessions on confirmed booking**

```sql
CREATE OR REPLACE FUNCTION cancel_draft_sessions_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('confirmed', 'completed') THEN
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

CREATE TRIGGER trg_cancel_draft_sessions_on_booking
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION cancel_draft_sessions_on_booking();
```

**Add function: auto cancel expired sessions**

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
```

### 1f. Update Section 5 - RLS policies

**Update `update_session_participant_count` trigger:**

The `requested` status should NOT increment `current_participants`. Only `confirmed` counts. The existing trigger already handles this correctly (only counts `confirmed`), but add a comment making it explicit that `requested` participants are not counted.

### 1g. Section 17 - Requirements Traceability

Add rows for:

- Draft session lifecycle
- Request-to-join flow
- Auto-cancellation rules
- Bidirectional booking-session link
- Realtime slot updates (required)

---

## PHASE 2: Update SPORTLY-IMPLEMENTATION-GUIDE.md

### 2a. Phase 7 (Booking Engine) updates

**Section 7.1 - Slot Generator:**

Update `TimeSlot` interface:

```typescript
export interface SlotSession {
  id: string;
  title: string;
  visibility: 'public' | 'private';
  currentParticipants: number;
  maxParticipants: number;
  isConfirmed: boolean;
  organizerName: string;
  pricePerPersonEur: number | null;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked' | 'past' | 'closed';
  priceEur: number | null;
  priceLocal: number | null;
  sessions?: SlotSession[];  // public group sessions overlapping this slot
}
```

Add step 6b to algorithm:

```
6b. Fetch public group_sessions for field+date (where is_cancelled = false)
    -> For each session, find overlapping slots by time range
    -> Attach to slot.sessions[]
    -> Filter out sessions past confirmation_deadline as safety check
```

**Section 7.4 - create_booking_safe:**

Update with range overlap check (see Phase 1b).

**Section 7.5 - DailyScheduleGrid:**

Add Realtime subscription spec. Add 2-tab booking modal spec.

### 2b. Phase 9 (Group Sessions) - MAJOR REWRITE

Replace entire section with new session action signatures matching Phase 1c.

Update session page specs:

- `/sessions` listing: show draft AND confirmed public sessions with status badges
- `/sessions/[id]` detail: add Confirm Session, Edit, Approve/Decline UI
- `/sessions/new` wizard: all slots visible (booked greyed), draft messaging

### 2c. Phase 11 (Polish) updates

Move Realtime from "optional" to Phase 7 (required).

Add Phase 11.8: "Seed & Testing"

- Run seed.sql to populate demo data
- Test login as each test user
- Walk through all user flows

### 2d. Quick Reference table

Add new entries:

```
| Session confirm action   | lib/actions/session-actions.ts → confirmGroupSession() |
| Join request action      | lib/actions/session-actions.ts → requestToJoinSession() |
| SQL migration            | lib/db/migrations/001_session_draft_lifecycle.sql |
| Full SQL seed            | lib/db/seed.sql |
| Reusable DB queries      | lib/db/queries.ts |
```

---

## PHASE 3: SQL Schema Migration + Update supabase-schema.sql

### 3a. Create `lib/db/migrations/001_session_draft_lifecycle.sql`

This migration contains ALL SQL changes. Run in Supabase SQL Editor.

**Contents (in exact order):**

```sql
-- 1. Add new enum value
ALTER TYPE session_participant_status ADD VALUE IF NOT EXISTS 'requested';

-- 2. Add new columns to group_sessions
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ;
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- 3. Backfill: mark existing sessions with booking_id as confirmed
UPDATE group_sessions SET is_confirmed = true WHERE booking_id IS NOT NULL AND is_cancelled = false;

-- 4. Fix create_booking_safe with range overlap
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_field_id UUID,
  p_user_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_status booking_status,
  p_price_eur DECIMAL,
  p_price_local DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_booked_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  PERFORM id FROM fields WHERE id = p_field_id FOR UPDATE;

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
    status, total_price_eur, total_price_local, notes, booked_by
  ) VALUES (
    p_field_id, p_user_id, p_date, p_start_time, p_end_time,
    p_status, p_price_eur, p_price_local, p_notes, p_booked_by
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger: cancel draft sessions when slot is booked
CREATE OR REPLACE FUNCTION cancel_draft_sessions_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('confirmed', 'completed') THEN
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

DROP TRIGGER IF EXISTS trg_cancel_draft_sessions_on_booking ON bookings;
CREATE TRIGGER trg_cancel_draft_sessions_on_booking
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION cancel_draft_sessions_on_booking();

-- 6. Function: auto-cancel expired sessions (for pg_cron)
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

-- 7. Index for confirmation deadline queries
CREATE INDEX IF NOT EXISTS idx_sessions_confirmation_deadline
  ON group_sessions (confirmation_deadline)
  WHERE is_confirmed = false AND is_cancelled = false;

-- 8. Index for draft session lookup by field+date
CREATE INDEX IF NOT EXISTS idx_sessions_field_date_draft
  ON group_sessions (field_id, date)
  WHERE is_confirmed = false AND is_cancelled = false;
```

### 3b. Update `lib/db/supabase-schema.sql`

Apply all the changes from 3a into the master schema file so it stays the single source of truth. Specifically:

- Add `is_confirmed`, `confirmation_deadline`, `cancelled_reason` to the `CREATE TABLE group_sessions` block (lines ~197-220)
- Add `'requested'` to the `CREATE TYPE session_participant_status` enum (line ~5 area)
- Replace the `create_booking_safe` function body with range overlap version
- Add the two new functions and trigger after the existing triggers
- Add the two new indexes to the indexes section

---

## PHASE 4: Sync Drizzle Schema

**File: [lib/db/schema.ts](lib/db/schema.ts)**

### 4a. Update `participantStatusEnum` (line 51)

```typescript
// BEFORE:
export const participantStatusEnum = pgEnum('session_participant_status', [
  'invited', 'confirmed', 'declined', 'waitlisted',
]);

// AFTER:
export const participantStatusEnum = pgEnum('session_participant_status', [
  'invited', 'requested', 'confirmed', 'declined', 'waitlisted',
]);
```

### 4b. Add columns to `groupSessions` table (line 319)

Add after `isCancelled` (line 361):

```typescript
isConfirmed: boolean('is_confirmed').default(false),
confirmationDeadline: timestamp('confirmation_deadline', { withTimezone: true }),
cancelledReason: text('cancelled_reason'),
```

### 4c. Verify `bookings.sessionId` exists (line 300)

It already exists but has no FK reference to `groupSessions` in Drizzle (the FK is added via ALTER TABLE in SQL). This is fine -- the column exists for Drizzle type inference.

---

## PHASE 5: Comprehensive SQL Seed

**New file: `lib/db/seed.sql`**

This script is designed to run in the Supabase SQL Editor AFTER the schema and migration are applied.

### Test user accounts


| #   | Email                 | Password    | Profile Role  | Club Role              | Name          |
| --- | --------------------- | ----------- | ------------- | ---------------------- | ------------- |
| 1   | `admin@sportly.dev`   | `Test1234!` | `super_admin` | -                      | Sportly Admin |
| 2   | `club1@sportly.dev`   | `Test1234!` | `client`      | `club_admin` of Club 1 | Georgi Petrov |
| 3   | `club2@sportly.dev`   | `Test1234!` | `client`      | `club_admin` of Club 2 | Stefan Kolev  |
| 4   | `player1@sportly.dev` | `Test1234!` | `client`      | -                      | Alex Dimitrov |
| 5   | `player2@sportly.dev` | `Test1234!` | `client`      | -                      | Maria Ivanova |
| 6   | `player3@sportly.dev` | `Test1234!` | `client`      | -                      | Ivan Todorov  |


The seed must use `supabase.auth.admin.createUser()` or direct `INSERT INTO auth.users` with `encrypted_password` via `crypt()`. The `handle_new_user` trigger auto-creates profiles.

### Demo data structure

**2 clubs:**

- "Arena Rakovski" (football + padel), city: Sofia
- "Tennis Pro Sofia" (tennis + padel), city: Sofia

**3 locations:**

- Arena Rakovski - Central (Sofia, ul. Rakovski 120) -- 2 football fields + 1 padel
- Arena Rakovski - South (Sofia, bul. Bulgaria 45) -- 1 football field
- Tennis Pro - Lozenets (Sofia, ul. Krichim 8) -- 1 tennis + 1 padel

**6 fields with booking settings:**

- Pitch 1 (football, artificial_turf, outdoor, lit) -- 60min, 50€, auto_confirm=true
- Pitch 2 (football, grass, outdoor, no light) -- 60min, 40€
- Padel Court 1 (padel, hard_court, indoor, lit) -- 90min, 30€
- Pitch 3 (football, artificial_turf, indoor, lit) -- 60min, 60€
- Tennis Court 1 (tennis, clay, outdoor, lit) -- 60min, 25€
- Padel Court 2 (padel, hard_court, covered, lit) -- 90min, 35€

**Location schedules:** Mon-Fri 08:00-22:00, Sat 09:00-21:00, Sun 09:00-20:00

**10 bookings:** (dates relative to "today")

- 4 confirmed (upcoming, various fields)
- 2 completed (past)
- 2 cancelled (past)
- 2 confirmed (today)

**4 group sessions:**

1. "Friday Football 5v5" -- confirmed, public, on Pitch 1, upcoming, 6/10 participants
2. "Padel Beginners" -- draft, public, on Padel Court 1, upcoming, 2/4 requested
3. "Private Tennis Match" -- draft, private, on Tennis Court 1, upcoming
4. "Last Week Football" -- confirmed, public, completed, on Pitch 1, 8/10 participants

**Session participants:** mix of confirmed, requested, waitlisted across sessions

**Ratings:** 3 ratings from the completed session (#4), between player1/player2/player3

**Sport rankings:** populated for player1, player2, player3 in Football

---

## PHASE 6: Populate queries.ts

**File: [lib/db/queries.ts](lib/db/queries.ts)** (currently empty)

Create reusable typed query helpers used across the app:

```typescript
import { createClient } from '@/lib/supabase/server';

// Session with all relations (used by session detail page and session card)
export const SESSION_SELECT = `
  id, title, description, visibility, date, start_time, end_time,
  max_participants, current_participants, price_per_person_eur,
  skill_level_min, skill_level_max, is_cancelled, is_confirmed,
  confirmation_deadline, cancelled_reason, completed_at,
  organizer_id, booking_id, sport_category_id,
  profiles!group_sessions_organizer_id_fkey(id, full_name, avatar_url, city),
  sport_categories(id, name, slug, icon, color_primary),
  fields!inner(id, name, slug,
    locations!inner(id, name, city, address,
      clubs!inner(id, name, slug)))
` as const;

// Booking with relations (used by my bookings, dashboard bookings)
export const BOOKING_SELECT = `
  id, field_id, user_id, session_id, date, start_time, end_time,
  status, total_price_eur, total_price_local, notes, booked_by,
  fields!inner(name, slug,
    sport_categories(name, icon),
    locations!inner(name, city, address,
      clubs!inner(name, slug)))
` as const;

// Participant with profile (used by session detail)
export const PARTICIPANT_SELECT = `
  id, user_id, status, joined_at,
  profiles!session_participants_user_id_fkey(
    id, full_name, avatar_url, city)
` as const;

// Helper to compute session status from DB fields
export type SessionStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';

export function getSessionStatus(session: {
  is_cancelled: boolean;
  cancelled_reason: string | null;
  completed_at: string | null;
  is_confirmed: boolean;
}): SessionStatus {
  if (session.is_cancelled && session.cancelled_reason === 'deadline_expired') return 'expired';
  if (session.is_cancelled) return 'cancelled';
  if (session.completed_at) return 'completed';
  if (session.is_confirmed) return 'active';
  return 'draft';
}

// Helper to check if user can request to join
export function canRequestToJoin(session: {
  visibility: string;
  is_cancelled: boolean;
  completed_at: string | null;
  max_participants: number;
  current_participants: number;
  date: string;
}, currentUserId: string | null, isParticipant: boolean): boolean {
  if (!currentUserId) return false;
  if (isParticipant) return false;
  if (session.visibility !== 'public') return false;
  if (session.is_cancelled || session.completed_at) return false;
  if (session.current_participants >= session.max_participants) return false;
  const isPast = new Date(session.date + 'T23:59:59') < new Date();
  if (isPast) return false;
  return true;
}
```

---

## PHASE 7: Fix booking-actions.ts

**File: [lib/actions/booking-actions.ts](lib/actions/booking-actions.ts)**

### 7a. Always confirm regular bookings

Line 150 in `createPublicBooking`:

```typescript
// BEFORE:
const status = params.autoConfirm ? 'confirmed' : 'pending';
// AFTER:
const status = 'confirmed' as const;
```

### 7b. Add `session_id` to booking query in My Bookings page

**File: [app/(public)/my/bookings/page.tsx](app/(public)**/my/bookings/page.tsx)

Add `session_id` to the `.select()` call so the booking card can link to the session.

---

## PHASE 8: Rewrite session-actions.ts

**File: [lib/actions/session-actions.ts](lib/actions/session-actions.ts)**

### 8a. `createGroupSession` -- no booking, draft only

Remove `create_booking_safe` call. Insert with `booking_id = null`, `is_confirmed = false`. Compute `confirmation_deadline` as `start_time - 2h`.

### 8b. Add `confirmGroupSession(sessionId)`

Organizer-only. Creates booking via `create_booking_safe`. Updates `group_sessions.booking_id`, `is_confirmed = true`. Updates `bookings.session_id` (bidirectional). If `SLOT_ALREADY_BOOKED`, return error.

### 8c. Add `editGroupSession(sessionId, data)`

Organizer-only. Editable: title, description, maxParticipants, skillLevelMin, skillLevelMax, pricePerPersonEur, pricePerPersonLocal, visibility. NOT editable: date, time, field.

### 8d. Rename `joinSession` -> `requestToJoinSession`

For public sessions: insert participant with `status = 'requested'`. Keep skill check. Do NOT increment `current_participants` (trigger only counts `confirmed`).

### 8e. Add `approveJoinRequest(sessionId, userId)`

Organizer-only. Update `status` from `requested` to `confirmed`. Check `current_participants < max_participants`.

### 8f. Add `declineJoinRequest(sessionId, userId)`

Organizer-only. Update `status` from `requested` to `declined`.

### 8g. Keep `acceptInvite` as-is

Private invite flow: accepting sets status to `confirmed` directly.

### 8h. Update `cancelSession`

Set `cancelled_reason = 'manual'`. Cancel the linked booking if exists.

---

## PHASE 9: Enhance slot-generator.ts

**File: [lib/booking/slot-generator.ts](lib/booking/slot-generator.ts)**

### 9a. Add `SlotSession` interface and extend `TimeSlot`

As specified in Phase 6 queries.ts types.

### 9b. New step 6b: attach public sessions

After step 6 (mark booked), query `group_sessions` where `field_id = fieldId AND date = date AND is_cancelled = false AND visibility = 'public'`. Filter out sessions past `confirmation_deadline` (on-access safety). For each session, find overlapping slots by time range and attach to `slot.sessions[]`.

### 9c. Pass sessions through `getScheduleForDate`

**File: [lib/actions/schedule-actions.ts](lib/actions/schedule-actions.ts)**

No changes needed -- `FieldSchedule.slots` is `TimeSlot[]`, which now includes `sessions?`. The types flow automatically.

---

## PHASE 10: Redesign booking-modal.tsx

**File: [components/booking/booking-modal.tsx](components/booking/booking-modal.tsx)**

### 10a. Add `sessions` prop

```typescript
interface BookingModalProps {
  // ... existing props ...
  sessions?: SlotSession[];  // public sessions on this slot
}
```

### 10b. Add tab UI using shadcn `Tabs`

Tab 1 "Book Directly": existing booking form + group session checkbox. When checkbox checked, button changes to "Create Draft Session" and calls `createGroupSession` (not `createPublicBooking`).

Tab 2 "Join Session": list of `sessions[]` with RequestToJoin button per session. Only shown if `sessions?.length > 0`.

### 10c. Fix button labeling

- No checkbox: "Confirm Booking"
- Checkbox checked: "Create Draft Session"
- Join tab: "Request to Join"

---

## PHASE 11: Update Slot Cell + Grid

**File: [components/booking/slot-cell.tsx](components/booking/slot-cell.tsx)**

For available slots: if `slot.sessions?.length > 0`, show a small badge `"{n} sessions"` below the price. Style: muted text, small icon.

**File: [components/booking/daily-schedule-grid.tsx](components/booking/daily-schedule-grid.tsx)**

Update `handleSlotClick` to pass `slot.sessions` to the `BookingModal`:

```typescript
function handleSlotClick(fs: FieldSchedule, slot: TimeSlot) {
  if (slot.status !== 'available') return;
  setModalState({
    fieldId: fs.field.id,
    fieldName: fs.field.name,
    slot,
    durationMinutes: fs.bookingSettings?.slotDurationMinutes ?? 60,
    sessions: slot.sessions ?? [],  // NEW
  });
}
```

---

## PHASE 12: Session Detail Page

**File: [app/(public)/sessions/[id]/page.tsx**](app/(public)/sessions/[id]/page.tsx)

Add `is_confirmed, confirmation_deadline, cancelled_reason` to the select query.

Also fetch participants with `status = 'requested'` separately for the organizer's approval UI.

**File: [app/(public)/sessions/[id]/session-detail-client.tsx**](app/(public)/sessions/[id]/session-detail-client.tsx)

### 12a. Status banner system

Use `getSessionStatus()` from queries.ts. Show colored banners:

- Draft (yellow): "This session is a draft. The organizer has not confirmed it yet."
- Active (green): "This session is confirmed."
- Completed (blue): existing
- Cancelled (red): existing + show `cancelled_reason` if `slot_taken` or `deadline_expired`
- Expired (gray): "This session expired because it was not confirmed in time."

### 12b. Organizer actions by status

**Draft:** "Confirm Session" (prominent, primary button), "Edit", "Cancel"
**Active:** "Edit", "Invite Players", "Cancel", and after session time: "Mark Complete"
**Completed:** "Rate Players" section

### 12c. Join request approval section (organizer only)

New section below participants list. Shows participants with `status = 'requested'`:

```
Join Requests (3 pending)
┌──────────────────────────────────────┐
│ Alex D. · Rating: 4.2 · Sofia       │
│              [Approve] [Decline]     │
│ Maria I. · Rating: 3.5 · Plovdiv    │
│              [Approve] [Decline]     │
└──────────────────────────────────────┘
```

### 12d. Replace "Join" with "Request to Join"

For public sessions, change the button text and behavior.

---

## PHASE 13: My Pages + SessionCard

### 13a. SessionCard status badges

**File: [components/sessions/session-card.tsx](components/sessions/session-card.tsx)**

Add `is_confirmed`, `is_cancelled`, `cancelled_reason`, `completed_at` to `SessionCardData`. Show status badge using `getSessionStatus()`:

- Draft: yellow badge
- Active: green badge
- Completed: blue badge
- Cancelled: red badge
- Expired: gray badge

### 13b. My Sessions -- Confirm CTA

**File: [app/(public)/my/sessions/my-sessions-client.tsx](app/(public)**/my/sessions/my-sessions-client.tsx)

For draft sessions where user is organizer: show inline "Confirm" button. Show pending request count badge.

### 13c. My Bookings -- session link

**File: [app/(public)/my/bookings/my-bookings-client.tsx](app/(public)**/my/bookings/my-bookings-client.tsx)

When booking has `session_id`, show "View Session" link.

---

## PHASE 14: Dashboard Group Sessions

**File: [app/(dashboard)/dashboard/group-sessions/page.tsx](app/(dashboard)**/dashboard/group-sessions/page.tsx)

Replace stub with full management page:

- Server component: load sessions for all fields in active club's locations
- Filters: location, sport, date range, status (all/draft/active/completed/cancelled), visibility
- Table: Title, Field, Location, Date/Time, Organizer, Participants, Status badge, Visibility badge
- Click row -> link to `/sessions/[id]`
- Actions: Cancel session (for club admins)

---

## PHASE 15: Supabase Realtime

**File: [components/booking/daily-schedule-grid.tsx](components/booking/daily-schedule-grid.tsx)**

```typescript
import { createClient } from '@/lib/supabase/client';

// Inside component, after schedule state is set:
useEffect(() => {
  const fieldIds = schedule.map(fs => fs.field.id);
  if (fieldIds.length === 0) return;

  const supabase = createClient();
  const channel = supabase
    .channel(`schedule-${locationId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'bookings',
      filter: `field_id=in.(${fieldIds.join(',')})`,
    }, () => fetchSchedule(selectedDate))
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'group_sessions',
      filter: `field_id=in.(${fieldIds.join(',')})`,
    }, () => fetchSchedule(selectedDate))
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [/* stable fieldIds string, selectedDate */]);
```

Must use the **browser client** (`lib/supabase/client.ts`), not the server client.

---

## PHASE 16: New Session Wizard Updates

**File: [app/api/sessions/slots/route.ts*](app/api/sessions/slots/route.ts)*

Change to return ALL slots (remove the `available` filter):

```typescript
// BEFORE:
const available = allSlots.filter((s) => s.status === 'available');
return NextResponse.json({ slots: available });

// AFTER:
return NextResponse.json({ slots: allSlots });
```

**File: [app/(public)/sessions/new/new-session-wizard.tsx](app/(public)**/sessions/new/new-session-wizard.tsx)

### 16a. Show all slots in step 3

Render booked/blocked/past slots as disabled (greyed out). Show session count badge on slots with public sessions.

### 16b. Update review step messaging

Add text: "This creates a **draft** session. You'll need to confirm it from the session page to reserve the slot."

### 16c. After creation redirect

Redirect to `/sessions/[id]` where the organizer sees the "Confirm Session" button.

---

## PHASE 17: Auto-Cancel Setup

### 17a. pg_cron (Supabase Dashboard)

Enable the `pg_cron` extension in Supabase Dashboard -> Database -> Extensions. Then run:

```sql
SELECT cron.schedule(
  'cancel-expired-sessions',
  '*/15 * * * *',
  $$ SELECT auto_cancel_expired_sessions() $$
);
```

### 17b. On-access safety in slot generator

When querying sessions in step 6b, filter:

```typescript
.or(`confirmation_deadline.is.null,confirmation_deadline.gt.${new Date().toISOString()}`)
```

This ensures expired sessions don't appear even if cron hasn't run yet.

---

## PHASE 18: Validation Checklist

Run through each test AFTER all phases are complete:


| #   | Bug/Feature               | Test Steps                                               | Expected Result                                              |
| --- | ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Stale slot data           | User1 books 08:00. User2 has grid open.                  | User2 sees 08:00 turn "Booked" within seconds.               |
| 2   | Confirmed booking blocks  | User1 confirmed at 08:00. User2 loads grid.              | 08:00 shows "Booked", non-clickable.                         |
| 3   | Draft doesn't block       | Create draft session at 09:00. User2 loads grid.         | 09:00 is "available" with "1 session" badge.                 |
| 4   | Auto-cancel on deadline   | Wait for draft deadline to pass.                         | Session status = Expired. Slot remains available.            |
| 5   | Public session on grid    | Public draft session exists. User2 clicks slot.          | 2-tab modal shows session in "Join Session" tab.             |
| 6   | Request to join           | User clicks "Request to Join".                           | Participant with status=requested. Organizer sees request.   |
| 7   | Approve request           | Organizer approves.                                      | Status -> confirmed. Participant count increments.           |
| 8   | Decline request           | Organizer declines.                                      | Status -> declined.                                          |
| 9   | Confirm session           | Organizer confirms draft session.                        | Booking created. Slot becomes "Booked". Session is "Active". |
| 10  | Confirm fails (taken)     | Slot booked by someone else. Organizer tries to confirm. | Error: "Slot already booked." Session stays draft.           |
| 11  | Slot taken cancels drafts | Draft at 09:00. User2 books 09:00 directly.              | Draft auto-cancelled, reason=slot_taken.                     |
| 12  | Booking modal draft       | Check "Create group session" + confirm.                  | Draft session created. Toast: "Draft session created."       |
| 13  | Edit session              | Organizer edits title + max participants.                | Changes saved, refreshed.                                    |
| 14  | Session status badges     | View sessions in listing, detail, my sessions.           | Correct badges: Draft/Active/Completed/Cancelled/Expired.    |
| 15  | My Bookings link          | Booking linked to confirmed session.                     | "View Session" link visible.                                 |
| 16  | Dashboard sessions        | Club admin views /dashboard/group-sessions.              | Table with filters, status badges, management.               |
| 17  | Wizard all slots          | Create session wizard, slot step.                        | All slots visible. Booked greyed out. Session badges.        |
| 18  | Seed data                 | Run seed.sql. Login as test users.                       | All data visible. Full flow testable.                        |
| 19  | Private invite            | Organizer invites player to private session.             | Invite sent. Player accepts -> auto-confirmed.               |
| 20  | Realtime on sessions      | Draft session cancelled (slot taken). Grid open.         | Grid refreshes, session badge disappears.                    |


---

## File Change Summary

### New files (4):

- `lib/db/migrations/001_session_draft_lifecycle.sql`
- `lib/db/seed.sql`
- (updates to 2 doc files count as modifications)

### Modified files - Foundation (6):

- `docs/SPORTLY-BLUEPRINT.md` -- session lifecycle, triggers, slot spec
- `docs/SPORTLY-IMPLEMENTATION-GUIDE.md` -- phases 7, 9, 11 updates
- `lib/db/supabase-schema.sql` -- new columns, enum, functions, triggers
- `lib/db/schema.ts` -- Drizzle sync
- `lib/db/queries.ts` -- reusable query helpers
- `lib/db/seed.ts` -- update to reference seed.sql or keep as minimal

### Modified files - Actions (2):

- `lib/actions/booking-actions.ts` -- always confirmed
- `lib/actions/session-actions.ts` -- 6 new/modified actions

### Modified files - Slot engine (1):

- `lib/booking/slot-generator.ts` -- SlotSession metadata, range overlap

### Modified files - UI (8):

- `components/booking/booking-modal.tsx` -- 2-tab redesign
- `components/booking/slot-cell.tsx` -- session badge
- `components/booking/daily-schedule-grid.tsx` -- Realtime + session props
- `components/sessions/session-card.tsx` -- status badges
- `app/(public)/sessions/[id]/session-detail-client.tsx` -- confirm/edit/approve
- `app/(public)/sessions/[id]/page.tsx` -- new columns in query
- `app/(public)/my/sessions/my-sessions-client.tsx` -- confirm CTA
- `app/(public)/my/bookings/my-bookings-client.tsx` -- session link

### Modified files - Pages (4):

- `app/(public)/sessions/page.tsx` -- include draft sessions, new columns
- `app/(public)/my/bookings/page.tsx` -- add session_id to select
- `app/(dashboard)/dashboard/group-sessions/page.tsx` -- full implementation
- `app/(public)/sessions/new/new-session-wizard.tsx` -- all slots, draft messaging

### Modified files - API (1):

- `app/api/sessions/slots/route.ts` -- return all slots

