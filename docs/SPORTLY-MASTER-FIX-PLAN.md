# SPORTLY — MASTER BUG FIX PLAN (v2)

> **44 issues. 8 waves. Booking-first priority.**
> Each fix is marked: 🗄️ SQL (run in Supabase SQL Editor) · 🖥️ CODE (Cursor prompt) · 🔧 MANUAL (dashboard action)
> Wave 1 is entirely SQL + manual — no code deployment needed.

---

# EXECUTION ORDER


| Wave  | Focus                 | Issues   | Goal                                              |
| ----- | --------------------- | -------- | ------------------------------------------------- |
| **1** | DB Foundation         | 7 issues | Secure the database, fix triggers                 |
| **2** | Slot Visibility       | 5 issues | Users see correct slot availability               |
| **3** | Booking Integrity     | 5 issues | Bookings cannot overlap, lifecycle works          |
| **4** | Session Lifecycle     | 6 issues | Draft → Active → Complete → Rate works end-to-end |
| **5** | Session Participation | 5 issues | Join, invite, accept, leave all work              |
| **6** | Navigation & Routing  | 4 issues | Sport selection, sign-out, redirects              |
| **7** | UI & Display          | 6 issues | Correct display, deduplication, warnings          |
| **8** | Schema Cleanup        | 6 issues | Type safety, indexes, minor gaps                  |


---

# WAVE 1 — DB FOUNDATION

*Run everything in this wave in Supabase SQL Editor. No code deployment needed.*

---

### 1.1 — SECURITY: All 10 Functions Have Mutable `search_path` - DONE

**ID:** DB-4 · **Severity:** Security · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE OR REPLACE FUNCTION is_club_admin(check_club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = auth.uid()
      AND club_id = check_club_id
      AND role = 'club_admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION is_club_member(check_club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = auth.uid()
      AND club_id = check_club_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION is_session_participant(check_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.session_participants
    WHERE user_id = auth.uid()
      AND session_id = check_session_id
      AND status = 'confirmed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```

---

### 1.2 — Missing `updated_at` Auto-Update Triggers - DONE

**ID:** DB-3 / Gap-6 · **Severity:** Critical · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'profiles', 'clubs', 'locations', 'fields',
      'field_booking_settings', 'bookings',
      'group_sessions', 'user_sport_rankings'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END $$;
```

---

### 1.3 — Missing Super Admin RLS Policies on 5 Tables - DONE

**ID:** DB-2 · **Severity:** Critical · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE POLICY "Super admins full access on group_sessions"
  ON group_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins full access on session_invites"
  ON session_invites FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins full access on session_participants"
  ON session_participants FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins full access on user_ratings"
  ON user_ratings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins full access on user_rating_details"
  ON user_rating_details FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
```

---

### 1.4 — No RLS Policies for Anonymous Users on Public Data - DONE

**ID:** J · **Severity:** Critical · 🗄️ SQL

**This is the root cause of Bugs 3, 4, and 5 combined.**

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE POLICY "Public read active sport categories" ON sport_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active clubs" ON clubs FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active locations" ON locations FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active fields" ON fields FOR SELECT USING (is_active = true);
CREATE POLICY "Public read location schedules" ON location_schedules FOR SELECT USING (true);
CREATE POLICY "Public read field attributes" ON field_attributes FOR SELECT USING (true);
CREATE POLICY "Public read field booking settings" ON field_booking_settings FOR SELECT USING (true);
CREATE POLICY "Public read active sessions" ON group_sessions FOR SELECT USING (visibility = 'public' AND is_cancelled = false);
CREATE POLICY "Public read rankings" ON user_sport_rankings FOR SELECT USING (true);

-- CRITICAL for booking flow: slot generator must see ALL bookings
CREATE POLICY "Public read non-cancelled bookings" ON bookings FOR SELECT USING (status != 'cancelled');
```

---

### 1.5 — Minor RLS Gaps - DONE 

**ID:** DB-6, DB-7, DB-8 · **Severity:** Minor · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Super admins can manage rankings"
  ON user_sport_rankings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can manage ratings"
  ON user_ratings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Raters can delete own ratings"
  ON user_ratings FOR DELETE
  USING (rater_id = auth.uid());
```

---

### 1.6 — Enable Leaked Password Protection

**ID:** DB-5 · **Severity:** Security · 🔧 MANUAL

**Action:** Supabase Dashboard → Authentication → Settings → Security → Toggle ON "Check passwords against HaveIBeenPwned" → Save.

---

### 1.7 — `cancel_draft_sessions_on_booking` Trigger: Add UPDATE

**ID:** G · **Severity:** Medium · 🗄️ SQL

Already fixed in 1.1 (the function now handles both INSERT and UPDATE). Just need to recreate the trigger:

🗄️ **Run in Supabase SQL Editor:**

```sql
DROP TRIGGER IF EXISTS on_booking_cancel_draft_sessions ON bookings;

CREATE TRIGGER on_booking_cancel_draft_sessions
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION cancel_draft_sessions_on_booking();
```

---

# WAVE 2 — SLOT VISIBILITY

*Users must see correct slot availability. This is the core booking UX.*

---

### 2.1 — All Slots Shown as Available / Booked Slots Not Blocked - DONE

**ID:** 4, 5 · **Severity:** CRITICAL · 🖥️ CODE

**Cursor prompt:**

```
CRITICAL BUG: All slots appear as "available" even when confirmed bookings exist. This is the #1 booking flow blocker.

In lib/booking/slot-generator.ts (or wherever getAvailableSlots / getScheduleForDate is implemented):

1. Query ALL non-cancelled bookings for the field+date using supabaseAdmin (service role client, bypasses RLS):
   SELECT * FROM bookings WHERE field_id = ? AND date = ? AND status NOT IN ('cancelled')

2. For each generated time slot, check if ANY booking overlaps using range logic:
   booking.start_time < slot.end_time AND booking.end_time > slot.start_time

3. If overlap found: set slot.status = 'booked', attach booking info

4. IMPORTANT: Use supabaseAdmin from lib/supabase/admin.ts — NOT the regular server client. The regular client is subject to RLS, which means logged-out users see no bookings, and logged-in users only see their own. Slot availability must reflect ALL bookings regardless of who made them.

5. Also query group_sessions for draft/active sessions overlapping each slot:
   SELECT * FROM group_sessions WHERE field_id = ? AND date = ? AND is_cancelled = false AND visibility = 'public' AND start_time < slot.end_time AND end_time > slot.start_time
   Attach these to slot.sessions[] for the "Join Session" tab badge count.
```

---

### 2.2 — `field_availability` Overrides Never Queried - DONE

**ID:** Gap-4 · **Severity:** High · 🖥️ CODE

**Cursor prompt:**

```
The field_availability table is designed for per-field overrides (maintenance blocks, holidays, specific date closures) but is never queried by the slot generator.

In the slot generation algorithm, after getting the location schedule and before generating slots:

1. Query field_availability for the specific date:
   SELECT * FROM field_availability WHERE field_id = ? AND specific_date = ?

2. Query field_availability for the day of week:
   SELECT * FROM field_availability WHERE field_id = ? AND day_of_week = ? AND specific_date IS NULL

3. For each availability override:
   - If is_available = false: mark overlapping slots as 'blocked' with the reason text
   - If is_available = true: override location-level closed status

4. Apply overrides AFTER location schedule but BEFORE booking checks
```

---

### 2.3 — Redirect When No Slots Available

**ID:** 17 · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
When all slots are booked for the current day, or the pitch doesn't operate that day, the user sees an empty grid.

In the DailyScheduleGrid component:

1. After loading slots: check if ALL slots are booked, blocked, past, or closed
2. If no available slots for the selected date:
   a. Show a banner: "No available slots for [date]. Showing next available date."
   b. Auto-query the next date (within max_booking_advance_days) that has available slots
   c. Navigate to that date automatically
3. If location is closed: show "Closed on [day]" with redirect to next open day
4. If no availability in entire window: "No availability. Contact the club directly."
```

---

### 2.4 — Landing Page Reservations Count Shows 0 When Logged Out

**ID:** 3 · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
The landing page reservations/players counts show 0 when no user is logged in.

In the landing page server component (app/(public)/page.tsx):

1. Use supabaseAdmin (service role) from lib/supabase/admin.ts — NOT the regular server client:
   const { count: bookingsCount } = await supabaseAdmin.from('bookings').select('*', { count: 'exact', head: true }).in('status', ['confirmed', 'completed'])
   const { count: playersCount } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client')

2. These are public platform-wide stats — RLS should not apply.
```

---

### 2.5 — Slot Grid Component Not Reused

**ID:** 9 · **Severity:** Low · 🖥️ CODE

**Cursor prompt:**

```
The DailyScheduleGrid component should be reused everywhere slots are displayed. Add a mode prop:

1. mode="booking" (default) — clickable slots open the booking modal
2. mode="selection" — clickable slots emit onSlotSelected callback, for session creation wizard
3. mode="readonly" — non-interactive display

Use this in the session creation wizard step 3 instead of a custom slot picker.
```

---

# WAVE 3 — BOOKING INTEGRITY

*Prevent double bookings, complete stale bookings, validate data.*

---

### 3.1 — Stale Bookings Never Auto-Complete

**ID:** DB-1 · **Severity:** Critical · 🗄️ SQL + 🖥️ CODE

🗄️ **Run in Supabase SQL Editor:**

```sql
-- Create the function
CREATE OR REPLACE FUNCTION auto_complete_past_bookings()
RETURNS void AS $$
BEGIN
  -- Complete stale bookings
  UPDATE public.bookings
  SET status = 'completed',
      updated_at = now()
  WHERE status = 'confirmed'
    AND (date + end_time) < now();

  -- Also auto-complete linked sessions
  UPDATE public.group_sessions gs
  SET completed_at = now(),
      updated_at = now()
  FROM public.bookings b
  WHERE b.session_id = gs.id
    AND b.status = 'completed'
    AND gs.completed_at IS NULL
    AND gs.is_cancelled = false
    AND gs.is_confirmed = true
    AND (gs.date + gs.end_time) < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Schedule via pg_cron (every 30 minutes)
DO $$ BEGIN
  PERFORM cron.unschedule('auto-complete-past-bookings');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-complete-past-bookings',
  '*/30 * * * *',
  $$ SELECT auto_complete_past_bookings(); $$
);

-- Run once NOW to fix existing stale bookings
SELECT auto_complete_past_bookings();
```

🖥️ **Cursor prompt (Vercel Cron fallback):**

```
Create a Vercel Cron fallback at app/api/cron/auto-complete-bookings/route.ts:
- Verify Bearer CRON_SECRET from Authorization header
- Call supabaseAdmin.rpc('auto_complete_past_bookings')
- Return { success: true } or error

Add to vercel.json:
{ "crons": [
  { "path": "/api/cron/auto-complete-bookings", "schedule": "*/30 * * * *" },
  { "path": "/api/cron/auto-cancel", "schedule": "*/15 * * * *" }
]}

Add CRON_SECRET to .env.local and Vercel environment variables.
```

---

### 3.2 — Booking Overlap Index Too Narrow

**ID:** C · **Severity:** High · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
-- Enable the extension (needed for exclusion constraints)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop the old narrow index
DROP INDEX IF EXISTS idx_bookings_no_overlap;

-- Add proper range overlap exclusion constraint
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    field_id WITH =,
    date WITH =,
    tsrange(
      ('2000-01-01'::date + start_time)::timestamp,
      ('2000-01-01'::date + end_time)::timestamp
    ) WITH &&
  ) WHERE (status != 'cancelled');
```

> **If btree_gist is not available**, skip this and rely on `create_booking_safe()` — but ensure ALL booking inserts go through it.

---

### 3.3 — Draft Sessions Can Be Created Over Booked Slots

**ID:** 7 · **Severity:** High · 🖥️ CODE

**Cursor prompt:**

```
Users can create draft sessions on already-booked slots, which is misleading.

Fix in lib/actions/session-actions.ts → createGroupSession:
1. Before inserting the draft session, check for existing confirmed bookings:
   const { data } = await supabaseAdmin.from('bookings')
     .select('id').eq('field_id', fieldId).eq('date', date)
     .lt('start_time', endTime).gt('end_time', startTime)
     .neq('status', 'cancelled').limit(1);
   if (data?.length) return { success: false, error: 'SLOT_ALREADY_BOOKED' };

Fix in the session creation wizard slot picker:
2. Slots with confirmed bookings must be greyed out and non-selectable
3. Show tooltip "This slot is already booked" on hover
```

---

### 3.4 — No Time Order Validation

**ID:** P · **Severity:** Medium · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
ALTER TABLE bookings ADD CONSTRAINT bookings_time_order CHECK (end_time > start_time);
ALTER TABLE group_sessions ADD CONSTRAINT sessions_time_order CHECK (end_time > start_time);
ALTER TABLE location_schedules ADD CONSTRAINT schedules_time_order CHECK (close_time > open_time OR is_closed = true);
ALTER TABLE field_availability ADD CONSTRAINT availability_time_order CHECK (end_time > start_time);
```

---

### 3.5 — `bookings.sessionId` Missing FK Reference in Drizzle

**ID:** A · **Severity:** Medium · 🗄️ SQL + 🖥️ CODE

🗄️ **Run in Supabase SQL Editor (if FK doesn't already exist in DB):**

```sql
-- Check if FK exists
SELECT constraint_name FROM information_schema.referential_constraints rc
JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
WHERE kcu.table_name = 'bookings' AND kcu.column_name = 'session_id';

-- If no result, add it:
ALTER TABLE bookings
  ADD CONSTRAINT bookings_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES group_sessions(id) ON DELETE SET NULL;
```

🖥️ **Cursor prompt:**

```
In lib/db/schema.ts, bookings table's sessionId column is missing its foreign key reference. Change:
  sessionId: uuid('session_id'),
to:
  sessionId: uuid('session_id').references(() => groupSessions.id, { onDelete: 'set null' }),
```

---

# WAVE 4 — SESSION LIFECYCLE

*Draft → Active → Completed → Rate must work end-to-end.*

---

### 4.1 — Session Auto-Cancellation Not Working

**ID:** 11 · **Severity:** High · 🗄️ SQL + 🖥️ CODE

🗄️ **Run in Supabase SQL Editor (ensure cron job is scheduled):**

```sql
DO $$ BEGIN
  PERFORM cron.unschedule('auto-cancel-expired-sessions');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-cancel-expired-sessions',
  '*/15 * * * *',
  $$ SELECT auto_cancel_expired_sessions(); $$
);
```

🖥️ **Cursor prompt (Vercel Cron fallback):**

```
Create Vercel Cron fallback at app/api/cron/auto-cancel/route.ts:
- Verify Bearer CRON_SECRET from Authorization header
- Call supabaseAdmin.rpc('auto_cancel_expired_sessions')
- Return { success: true, cancelled: count }

Ensure vercel.json already has:
{ "path": "/api/cron/auto-cancel", "schedule": "*/15 * * * *" }
```

---

### 4.2 — Rankings Show "2 ratings from 0 sessions"

**ID:** 13 · **Severity:** Medium · 🗄️ SQL + 🖥️ CODE

🗄️ **Run in Supabase SQL Editor (fix existing bad data):**

```sql
-- Fix any rankings where ratings > 0 but sessions = 0
UPDATE user_sport_rankings
SET total_sessions_played = GREATEST(total_sessions_played, 1)
WHERE total_ratings_received > 0 AND total_sessions_played = 0;
```

🖥️ **Cursor prompt:**

```
Rankings page shows "Based on 2 ratings from 0 sessions" — contradictory.

1. In the markSessionComplete server action, increment total_sessions_played for ALL confirmed participants:
   UPDATE user_sport_rankings SET total_sessions_played = total_sessions_played + 1
   WHERE user_id IN (SELECT user_id FROM session_participants WHERE session_id = $1 AND status = 'confirmed')
   AND sport_category_id = $2

2. In /my/rankings display: if total_sessions_played is 0 but total_ratings_received > 0, show total_ratings_received as minimum sessions count
```

---

### 4.3 — Organizer Can Leave Their Own Session

**ID:** Q · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
The leaveSession server action must prevent the organizer from leaving.

In lib/actions/session-actions.ts → leaveSession:
1. Before deleting the participant:
   const session = await supabase.from('group_sessions').select('organizer_id').eq('id', sessionId).single();
   if (session.data?.organizer_id === currentUserId) {
     return { success: false, error: 'Organizer cannot leave their own session. Cancel it instead.' };
   }
```

---

### 4.4 — No Waitlist Promotion Logic

**ID:** Gap-5 · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
When a confirmed participant leaves, promote the first waitlisted person.

In lib/actions/session-actions.ts → leaveSession, after removing the participant:

1. Check if anyone is waitlisted:
   const { data: waitlisted } = await supabase.from('session_participants')
     .select('id, user_id').eq('session_id', sessionId).eq('status', 'waitlisted')
     .order('joined_at', { ascending: true }).limit(1);

2. If found, promote them:
   await supabase.from('session_participants')
     .update({ status: 'confirmed' }).eq('id', waitlisted[0].id);
```

---

### 4.5 — Timezone Ignored in Deadline Calculation

**ID:** H · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
computeConfirmationDeadline in lib/db/queries.ts creates a Date without timezone.

Fix — since Sportly operates in Bulgaria (EET/EEST):

export function computeConfirmationDeadline(date: string, startTime: string): Date {
  const isoString = date + 'T' + startTime + '+02:00'; // EET base
  const dateTime = new Date(isoString);
  dateTime.setHours(dateTime.getHours() - 2); // 2 hours before start
  return dateTime;
}

Better: use date-fns-tz for proper timezone handling including DST.
```

---

### 4.6 — No Rate Limiting on Session Creation

**ID:** Gap-3 · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
Add rate limiting to draft session creation.

In lib/actions/session-actions.ts → createGroupSession, before inserting:

1. Count active drafts:
   const { count } = await supabase.from('group_sessions')
     .select('*', { count: 'exact', head: true })
     .eq('organizer_id', userId).eq('is_confirmed', false).eq('is_cancelled', false);

2. If count >= 5: return { success: false, error: 'You can have at most 5 active draft sessions.' }
```

---

# WAVE 5 — SESSION PARTICIPATION

*Invite, join, accept, leave flows must work.*

---

### 5.1 — Invited Players Have No Accept/Reject Option

**ID:** 1 · **Severity:** High · 🖥️ CODE

**Cursor prompt:**

```
Invited players cannot accept or reject session invitations.

1. Ensure acceptInvite and declineInvite server actions exist in lib/actions/session-actions.ts
2. On the session detail page: when current user's participant status is 'invited', show Accept/Decline buttons
3. In /my/sessions: add "My Invites" tab querying session_participants WHERE user_id = current_user AND status = 'invited'
4. When accepting: update session_participants status to 'confirmed', update session_invites status to 'accepted'
5. When declining: update session_participants status to 'declined', update session_invites status to 'declined'
```

---

### 5.2 — Invite Link Auto-Acceptance Not Working

**ID:** 10 · **Severity:** High · 🖥️ CODE

**Cursor prompt:**

```
Implement the full invite link flow:

1. Create route: app/(public)/sessions/invite/[code]/page.tsx
2. On load:
   a. Look up session_invites WHERE invite_code = params.code AND status = 'pending'
   b. If not found or expired: show "Invalid or expired invite"
   c. If not authenticated: redirect to /auth/login?redirect=/sessions/invite/[code]
   d. If authenticated: insert session_participants with status = 'confirmed', update invite status, redirect to /sessions/[session_id]
3. Handle edge cases: already participant, session full → waitlist, session cancelled
```

---

### 5.3 — Organizer Shown as Separate Block

**ID:** 12 · **Severity:** Low · 🖥️ CODE

**Cursor prompt:**

```
Remove the separate "Organizer" block from session detail. Instead:
1. Mark the organizer with "👑 Organizer" badge in the participant list
2. If current user is NOT a participant: show only "👥 X/Y players" count, hide full list
```

---

### 5.4 — Duplicate Records in Upcoming Sessions

**ID:** 8 · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
User sees two entries for sessions they organize. Fix /my/sessions:
1. Query session_participants WHERE user_id = current_user AND status IN ('confirmed', 'requested', 'invited') → collect session IDs
2. Query group_sessions WHERE id IN those IDs
3. Do NOT also query by organizer_id — organizer is always a participant
4. Show "Organizer" badge if organizer_id matches current user
```

---

### 5.5 — No Notifications When Session Status Changes

**ID:** Gap-2 · **Severity:** Low · 🖥️ CODE

**Cursor prompt:**

```
For MVP, add Supabase Realtime subscriptions on /my/sessions:
1. Subscribe to session_participants and group_sessions changes for user's session IDs
2. When change detected: show toast + refresh list
3. On session detail page: subscribe to that specific session, auto-refresh on changes
```

---

# WAVE 6 — NAVIGATION & ROUTING

---

### 6.1 — Club Sport Selection Redirect Issues

**ID:** 14 · **Severity:** High · 🖥️ CODE

**Cursor prompt:**

```
When selecting a sport from a club page:
1. Make sport and location URL params: /clubs/[slug]?sport=football&location=main
2. When sport changes: filter locations to those with fields for that sport
3. Auto-select first location that HAS fields for the selected sport
4. Schedule grid should only show fields matching the selected sport
```

---

### 6.2 — Sign-Out Redirects to Not Found

**ID:** 2 · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
After signing out, user lands on 404. Fix:
1. In sign-out handler: after supabase.auth.signOut(), redirect to '/'
2. In middleware.ts: unauthenticated users on /dashboard/*, /admin/*, /my/* → redirect to /auth/login
```

---

### 6.3 — Attributes Scoped to Field Instead of Location

**ID:** 15 · **Severity:** Medium · 🗄️ SQL + 🖥️ CODE

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE TABLE IF NOT EXISTS location_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  UNIQUE(location_id, attribute_key)
);

CREATE INDEX IF NOT EXISTS idx_location_attributes_location ON location_attributes(location_id);

-- Enable RLS
ALTER TABLE location_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read location attributes" ON location_attributes FOR SELECT USING (true);
CREATE POLICY "Super admins full access on location_attributes" ON location_attributes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
```

🖥️ **Cursor prompt:**

```
Location-level amenities (parking, café, changing rooms) are wrongly on field_attributes.

1. Add location_attributes table to lib/db/schema.ts (same pattern as field_attributes but with locationId)
2. Move these keys from field_attributes to location_attributes: has_parking, has_cafe_bar, has_changing_rooms, has_fitness_area, has_equipment_rental
3. Keep as field_attributes: surface_type, environment, has_lighting, size, max_players, format
4. Update Location wizard and "About Club" tab accordingly
```

---

### 6.4 — Missing `city` Column on Clubs in SQL

**ID:** B · **Severity:** Low · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS city TEXT;
```

---

# WAVE 7 — UI & DISPLAY

---

### 7.1 — Missing "Slot Not Reserved" Warning on Draft Sessions

**ID:** 6 · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
On session detail page when status is 'draft', show amber Alert:
"⚠️ This session is not yet confirmed. The slot is NOT reserved — another user could book it. Confirm before [deadline] to reserve."
If deadline is within 2 hours: make banner red. If deadline passed: show "may be auto-cancelled soon."
```

---

### 7.2 — Status Display Missing `slot_taken` Reason

**ID:** K · **Severity:** Low · 🖥️ CODE

**Cursor prompt:**

```
Show cancellation reason on session cards:
- cancelled_reason = 'manual': "Cancelled by organizer"
- cancelled_reason = 'slot_taken': "Cancelled — slot was booked by another user"
- cancelled_reason = 'deadline_expired': "Expired — confirmation deadline passed"
```

---

### 7.3 — `fieldBookingSettings` Relation `many` → `one`

**ID:** L · **Severity:** Medium · 🖥️ CODE

**Cursor prompt:**

```
In lib/db/schema.ts, fieldsRelations defines bookingSettings: many(fieldBookingSettings), but it's 1:1.

Change to:
  bookingSettings: one(fieldBookingSettings, {
    fields: [fields.id],
    references: [fieldBookingSettings.fieldId],
  }),

Then fix all code using settings[0] to direct object access.
```

---

### 7.4 — Booking Status Filter: Use NOT IN ('cancelled')

**ID:** O · **Severity:** Low · 🖥️ CODE

**Cursor prompt:**

```
Audit all booking queries in slot-generator.ts, schedule-actions.ts, and booking-actions.ts.

Ensure slot availability queries use:
  .not('status', 'eq', 'cancelled')    // correct: blocks confirmed + completed + pending
NOT:
  .eq('status', 'confirmed')            // wrong: misses pending and completed bookings
```

---

### 7.5 — Rating Trigger Race Condition

**ID:** D · **Severity:** Medium · 🗄️ SQL

Already fixed in Wave 1.1 — `update_sport_ranking` now uses `SELECT COUNT(*)`. Verify by checking function body after Wave 1.

---

### 7.6 — Duplicate pg_cron Schedules

**ID:** M · **Severity:** Low · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
-- Check for duplicates
SELECT jobname, COUNT(*) FROM cron.job GROUP BY jobname HAVING COUNT(*) > 1;

-- If duplicates found, remove extras (keep lowest jobid):
-- DELETE FROM cron.job WHERE jobname = 'auto-cancel-expired-sessions' AND jobid != (SELECT MIN(jobid) FROM cron.job WHERE jobname = 'auto-cancel-expired-sessions');
```

---

# WAVE 8 — SCHEMA CLEANUP

---

### 8.1 — Self-Rating CHECK Constraint

**ID:** E · **Severity:** Medium · 🗄️ SQL + 🖥️ CODE

🗄️ **Run in Supabase SQL Editor:**

```sql
ALTER TABLE user_ratings ADD CONSTRAINT no_self_rating CHECK (rater_id != rated_id);
```

🖥️ **Cursor prompt:**

```
In lib/db/schema.ts, add to userRatings table:
  check('no_self_rating', sql`${table.raterId} != ${table.ratedId}`),
```

---

### 8.2 — `sessionInvites.status` Plain Text → Enum

**ID:** I · **Severity:** Low · 🗄️ SQL + 🖥️ CODE

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
ALTER TABLE session_invites ALTER COLUMN status TYPE invite_status USING status::invite_status;
ALTER TABLE session_invites ALTER COLUMN status SET DEFAULT 'pending';
```

🖥️ **Cursor prompt:**

```
In lib/db/schema.ts:
1. Add: export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'declined', 'expired']);
2. In sessionInvites table: change status to inviteStatusEnum('status').default('pending')
```

---

### 8.3 — Missing Indexes on `session_invites`

**ID:** N · **Severity:** Low · 🗄️ SQL

🗄️ **Run in Supabase SQL Editor:**

```sql
CREATE INDEX IF NOT EXISTS idx_session_invites_session ON session_invites(session_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_user ON session_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_email ON session_invites(invited_email) WHERE invited_email IS NOT NULL;
```

---

### 8.4 — Seed Data Uses Hardcoded UUIDs

**ID:** R · **Severity:** Low · 🖥️ CODE

**Cursor prompt:**

```
Refactor seed.sql to use DO $$ DECLARE ... BEGIN ... END $$ blocks with UUID variables instead of raw strings scattered throughout.
```

---

### 8.5 — Participant Count Trigger Return Value

**ID:** F · **Severity:** Low · 🗄️ SQL

Already fixed in Wave 1.1 — the function now uses `IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;`

---

### 8.6 — Missing Vercel Cron Fallback

**ID:** Gap-1 · **Severity:** Low · 🖥️ CODE

Already addressed in Waves 3.1 and 4.1. Verify both routes exist in `vercel.json`.

---

# QUICK REFERENCE: ALL 44 ISSUES


| #        | Issue                             | Wave | Type          | Severity     |
| -------- | --------------------------------- | ---- | ------------- | ------------ |
| DB-4     | Functions mutable search_path     | 1    | 🗄️ SQL       | Security     |
| DB-3     | No updated_at triggers            | 1    | 🗄️ SQL       | Critical     |
| DB-2     | 5 tables missing super admin RLS  | 1    | 🗄️ SQL       | Critical     |
| J        | No anonymous RLS on public data   | 1    | 🗄️ SQL       | Critical     |
| DB-6,7,8 | Minor RLS gaps                    | 1    | 🗄️ SQL       | Minor        |
| DB-5     | Leaked password protection        | 1    | 🔧 MANUAL     | Security     |
| G        | Draft cancel trigger INSERT-only  | 1    | 🗄️ SQL       | Medium       |
| 4,5      | Slots all shown as available      | 2    | 🖥️ CODE      | **CRITICAL** |
| Gap-4    | field_availability never queried  | 2    | 🖥️ CODE      | High         |
| 17       | No redirect when no slots         | 2    | 🖥️ CODE      | Medium       |
| 3        | Reservations count 0 logged out   | 2    | 🖥️ CODE      | Medium       |
| 9        | Slot grid not reused              | 2    | 🖥️ CODE      | Low          |
| DB-1     | Stale bookings never complete     | 3    | 🗄️ SQL + 🖥️ | Critical     |
| C        | Booking overlap index too narrow  | 3    | 🗄️ SQL       | High         |
| 7        | Draft sessions on booked slots    | 3    | 🖥️ CODE      | High         |
| P        | No time order validation          | 3    | 🗄️ SQL       | Medium       |
| A        | Missing FK on bookings.sessionId  | 3    | 🗄️ SQL + 🖥️ | Medium       |
| 11       | Auto-cancellation not working     | 4    | 🗄️ SQL + 🖥️ | High         |
| 13       | Rankings 2 ratings / 0 sessions   | 4    | 🗄️ SQL + 🖥️ | Medium       |
| Q        | Organizer can leave own session   | 4    | 🖥️ CODE      | Medium       |
| Gap-5    | No waitlist promotion             | 4    | 🖥️ CODE      | Medium       |
| H        | Timezone ignored in deadline      | 4    | 🖥️ CODE      | Medium       |
| Gap-3    | No rate limit on session creation | 4    | 🖥️ CODE      | Medium       |
| 1        | No accept/reject for invites      | 5    | 🖥️ CODE      | High         |
| 10       | Invite link auto-accept missing   | 5    | 🖥️ CODE      | High         |
| 12       | Organizer separate block          | 5    | 🖥️ CODE      | Low          |
| 8        | Duplicate upcoming sessions       | 5    | 🖥️ CODE      | Medium       |
| Gap-2    | No session status notifications   | 5    | 🖥️ CODE      | Low          |
| 14       | Club sport redirect broken        | 6    | 🖥️ CODE      | High         |
| 2        | Sign-out redirects to 404         | 6    | 🖥️ CODE      | Medium       |
| 15       | Attributes on wrong entity        | 6    | 🗄️ SQL + 🖥️ | Medium       |
| B        | Missing city on clubs SQL         | 6    | 🗄️ SQL       | Low          |
| 6        | No draft warning on session       | 7    | 🖥️ CODE      | Medium       |
| K        | Status display missing slot_taken | 7    | 🖥️ CODE      | Low          |
| L        | bookingSettings many vs one       | 7    | 🖥️ CODE      | Medium       |
| O        | Unused 'pending' in enum          | 7    | 🖥️ CODE      | Low          |
| D        | Rating trigger race condition     | 7    | 🗄️ SQL       | Medium       |
| M        | Duplicate pg_cron schedules       | 7    | 🗄️ SQL       | Low          |
| E        | Self-rating CHECK missing         | 8    | 🗄️ SQL + 🖥️ | Medium       |
| I        | Invite status not typed           | 8    | 🗄️ SQL + 🖥️ | Low          |
| N        | Missing indexes session_invites   | 8    | 🗄️ SQL       | Low          |
| R        | Hardcoded UUIDs in seed           | 8    | 🖥️ CODE      | Low          |
| F        | Participant count return value    | 8    | 🗄️ SQL       | Low          |
| Gap-1    | Vercel Cron fallback              | 8    | 🖥️ CODE      | Low          |


---

# HOW TO EXECUTE

### For 🗄️ SQL items:

1. Open Supabase Dashboard → SQL Editor → New Query
2. Copy the SQL block from the item
3. Click Run
4. If you get "already exists" errors, that's fine — the SQL is idempotent

### For 🖥️ CODE items:

1. Tell Cursor: "Read SPORTLY-MASTER-FIX-PLAN.md. We're on Wave N, issue N.N."
2. Paste the Cursor prompt
3. Let Cursor implement, review the changes

### For 🗄️ SQL + 🖥️ CODE items:

1. Run the SQL in Supabase FIRST
2. Then paste the Cursor prompt for the code changes

### For 🔧 MANUAL items:

1. Follow the action description in the Supabase dashboard

### Testing:

After each wave, run the verification scripts from SPORTLY-VERIFICATION-SCRIPTS.md.