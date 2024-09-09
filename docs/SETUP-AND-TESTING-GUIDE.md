# Sportly — Database Setup & End-to-End Testing Guide

This guide covers two things:

1. **Setting up the database from scratch** with all seed data
2. **Testing every feature end-to-end** with step-by-step instructions

---

## PART 1: DATABASE SETUP (FROM SCRATCH)

### Prerequisites

- A Supabase project (free tier is fine)
- Your `.env` file configured with Supabase credentials
- Node.js 18+ and `pnpm` installed

### Step 1: Reset the Supabase Database

Go to **Supabase Dashboard → Project Settings → General → Danger Zone** and click **"Reset Database"**.

> This wipes everything: tables, auth users, storage. Perfect for a clean start.

Wait ~30 seconds for the reset to complete.

### Step 2: Enable Required Extensions

Go to **Supabase Dashboard → Database → Extensions** and enable:

- **pg_cron** — for automatic session cancellation (search "pg_cron" and toggle it on)

### Step 3: Run the Master Schema

1. Go to **Supabase Dashboard → SQL Editor → New Query**
2. Copy the entire contents of `lib/db/supabase-schema.sql`
3. Paste and click **Run**

This creates:
- All enum types
- All 18+ tables with proper foreign keys and indexes
- Triggers (`handle_new_user`, `update_sport_ranking`, `update_session_participant_count`, `cancel_draft_sessions_on_booking`)
- Functions (`create_booking_safe`, `auto_cancel_expired_sessions`)
- RLS policies for all tables
- Seed data for sport categories (20 sports) and rating criteria (4 criteria)
- The pg_cron schedule for auto-cancelling expired drafts

> **If pg_cron gives an error:** That's okay — the `cron.schedule()` call at the bottom requires pg_cron enabled. If you get an error on that specific line, run it separately after enabling the extension, or skip it (the Vercel Cron fallback handles this).

### Step 4: Run the Migration (Session Lifecycle)

1. Still in **SQL Editor → New Query**
2. Copy the entire contents of `lib/db/migrations/001_session_draft_lifecycle.sql`
3. Paste and click **Run**

This adds:
- `requested` value to `session_participant_status` enum
- `is_confirmed`, `confirmation_deadline`, `cancelled_reason` columns to `group_sessions`
- New indexes for session queries
- Updated `create_booking_safe` function with time-range overlap check
- `cancel_draft_sessions_on_booking` trigger
- `auto_cancel_expired_sessions` function + pg_cron schedule

> **Note:** Some statements may say "already exists" — that's fine, the migration is idempotent.

### Step 5: Run the Seed Data

1. Still in **SQL Editor → New Query**
2. Copy the entire contents of `lib/db/seed.sql`
3. Paste and click **Run**

This creates:
- **6 test users** in `auth.users` (with login capability)
- **Profiles** with roles and cities
- **2 clubs** (Arena Rakovski in Sofia, Sportify Center in Plovdiv)
- **3 locations** with weekly schedules (Mon-Fri 07:00-22:00, Sat-Sun 08:00-20:00)
- **6 fields** (3 football, 1 padel, 1 tennis, 1 basketball) with booking settings and attributes
- **6 bookings** (confirmed, cancelled, past)
- **5 group sessions** (draft, active, completed, cancelled, private draft)
- **Participants** in various statuses (confirmed, requested, invited)
- **Ratings** for the completed session

### Step 6: Enable Realtime

Go to **Supabase Dashboard → Database → Replication** and enable replication for:

- `bookings`
- `group_sessions`

This powers the live slot grid updates.

### Step 7: Verify the Setup

Run these verification queries in the SQL Editor:

```sql
-- Check users
SELECT email, role, city FROM profiles ORDER BY email;
-- Expected: 6 rows (test1 through test6)

-- Check clubs
SELECT name, slug, city FROM clubs;
-- Expected: Arena Rakovski (Sofia), Sportify Center (Plovdiv)

-- Check locations
SELECT l.name, c.name AS club FROM locations l JOIN clubs c ON c.id = l.club_id;
-- Expected: 3 locations

-- Check fields
SELECT f.name, l.name AS location, sc.name AS sport
FROM fields f
JOIN locations l ON l.id = f.location_id
JOIN sport_categories sc ON sc.id = f.sport_category_id;
-- Expected: 6 fields

-- Check bookings
SELECT b.date, b.start_time, b.status, f.name AS field, p.email
FROM bookings b
JOIN fields f ON f.id = b.field_id
JOIN profiles p ON p.id = b.user_id
ORDER BY b.date;
-- Expected: 7 bookings (6 from seed + 1 for session S2)

-- Check sessions with status
SELECT title, is_confirmed, is_cancelled, cancelled_reason, current_participants
FROM group_sessions;
-- Expected: 5 sessions (draft, active, completed, cancelled, private draft)

-- Check participants
SELECT gs.title, sp.status, p.email
FROM session_participants sp
JOIN group_sessions gs ON gs.id = sp.session_id
JOIN profiles p ON p.id = sp.user_id
ORDER BY gs.title;
-- Expected: 11 participant rows across 5 sessions

-- Check rankings
SELECT p.email, usr.rating, usr.total_ratings_received, sc.name AS sport
FROM user_sport_rankings usr
JOIN profiles p ON p.id = usr.user_id
JOIN sport_categories sc ON sc.id = usr.sport_category_id;
-- Expected: user4 and user5 have football rankings
```

### Step 8: Start the App

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

---

## TEST ACCOUNTS

| Email | Password | Role | Name | Notes |
|-------|----------|------|------|-------|
| `test1@sportly.dev` | `Test1234!` | super_admin | Admin Super | Can impersonate any club |
| `test2@sportly.dev` | `Test1234!` | club_admin | Ivan Petrov | Admin of Arena Rakovski |
| `test3@sportly.dev` | `Test1234!` | staff | Maria Ivanova | Staff at Arena Rakovski |
| `test4@sportly.dev` | `Test1234!` | client | Georgi Dimitrov | Regular user, organizer of S1 and S3 |
| `test5@sportly.dev` | `Test1234!` | client | Elena Todorova | Regular user, organizer of S2, S4, S5 |
| `test6@sportly.dev` | `Test1234!` | trainer | Nikolay Trainer | Trainer at Sportify Center |

---

## SEEDED DATA REFERENCE

### Clubs
| Club | City | Admin |
|------|------|-------|
| Arena Rakovski | Sofia | test2 (Ivan Petrov) |
| Sportify Center | Plovdiv | — (test6 is trainer) |

### Locations & Fields
| Location | Club | Fields |
|----------|------|--------|
| Arena Rakovski Main (Sofia) | Arena Rakovski | Pitch 1 (football, 50€/hr), Pitch 2 (football, 35€/hr), Padel Court 1 (padel, 40€/90min) |
| Arena Rakovski South (Sofia) | Arena Rakovski | Tennis Court A (tennis, 30€/hr) |
| Sportify Plovdiv | Sportify Center | Main Pitch (football, 25€/hr), Basketball Court (basketball, 20€/hr) |

### Seeded Sessions
| ID | Title | Status | Visibility | Field | Date | Organizer |
|----|-------|--------|-----------|-------|------|-----------|
| S1 | Friday Pickup Football | **Draft** | Public | Pitch 1 | Today+2, 14:00 | test4 (Georgi) |
| S2 | Morning Football League | **Active** (confirmed) | Public | Pitch 2 | Today+1, 12:00 | test5 (Elena) |
| S3 | Evening Kickabout | **Completed** | Public | Pitch 2 | Yesterday, 18:00 | test4 (Georgi) |
| S4 | Tennis Doubles | **Cancelled** (manual) | Public | Tennis Court A | Today+4, 10:00 | test5 (Elena) |
| S5 | Private Training Match | **Draft** | Private | Main Pitch (Plovdiv) | Today+5, 17:00 | test5 (Elena) |

### Seeded Bookings
| Field | Date | Time | Status | User |
|-------|------|------|--------|------|
| Pitch 1 | Tomorrow | 08:00-09:00 | Confirmed | test4 |
| Pitch 1 | Tomorrow | 10:00-11:00 | Confirmed | test5 |
| Padel Court 1 | Day after tomorrow | 14:00-15:30 | Confirmed | test4 |
| Pitch 2 | Yesterday | 18:00-19:00 | Confirmed | test4 (linked to S3) |
| Pitch 1 | Today+3 | 09:00-10:00 | Cancelled | test5 |
| Main Pitch | 3 days ago | 16:00-17:00 | Confirmed | test5 |
| Pitch 2 | Tomorrow | 12:00-13:00 | Confirmed | test5 (linked to S2) |

---

## PART 2: END-TO-END TESTING

For each test, I note which user to log in as and what to verify. Use two browser windows (or one regular + one incognito) for multi-user tests.

---

### TEST 1: Authentication

#### 1.1 Login
1. Go to `/auth/login`
2. Enter `test4@sportly.dev` / `Test1234!`
3. **Verify:** Redirected to home page, user name visible in navbar

#### 1.2 Register New Account
1. Go to `/auth/register`
2. Fill in a new email (e.g. `newuser@test.com`), password, full name
3. **Verify:** Account created, profile page accessible at `/my/profile`

#### 1.3 Logout
1. Click user avatar → Sign Out
2. **Verify:** Redirected to home, auth-protected pages redirect to login

---

### TEST 2: Public Home & Sport Browsing

#### 2.1 Homepage
1. Visit `/` (no login required)
2. **Verify:** Sport icon bar shows (Football, Padel, Tennis, etc.), hero search visible

#### 2.2 Sport Category → Clubs
1. Click a sport icon (e.g. Football)
2. **Verify:** Redirected to `/sports/football/clubs`, shows Arena Rakovski and Sportify Center

#### 2.3 Club Detail
1. Click "Arena Rakovski"
2. **Verify:** Club page at `/clubs/arena-rakovski` shows locations, fields, about info

---

### TEST 3: Slot Grid & Booking Visibility (Bug #1 & #2 Fix)

> This tests that confirmed bookings are visible to ALL users and block the slot.

#### 3.1 Slots Show Correctly
1. Log in as **test5** (`test5@sportly.dev`)
2. Navigate to Arena Rakovski → Arena Rakovski Main location page
3. View the slot grid for **tomorrow's date**
4. **Verify:**
   - 08:00 slot on Pitch 1 shows as **booked** (green/occupied) — this is test4's booking
   - 10:00 slot on Pitch 1 shows as **booked** — this is test5's own booking
   - 09:00 slot on Pitch 1 shows as **available** (can be booked)
   - 12:00 slot on Pitch 2 shows as **booked** — this is the S2 session booking

#### 3.2 Booked Slots Are Non-Clickable
1. Click on the 08:00 booked slot on Pitch 1
2. **Verify:** Nothing happens (no booking modal opens), unless the slot has public sessions (then modal opens on Join tab)

#### 3.3 Multi-User Visibility
1. Open a second browser/incognito and log in as **test4** (`test4@sportly.dev`)
2. Navigate to the same location and date
3. **Verify:** Same slots show as booked — both users see identical grid state

---

### TEST 4: Regular Booking (Always Confirmed)

#### 4.1 Create a Regular Booking
1. Log in as **test4**
2. Go to Arena Rakovski Main → slot grid for tomorrow
3. Click an **available** slot (e.g. 09:00 on Pitch 1)
4. Booking modal opens on **"Book Directly"** tab
5. Leave "Session type" as "Regular Booking"
6. Click **"Book Now"**
7. **Verify:**
   - Toast: "Booking confirmed!"
   - Slot now shows as **booked** on the grid
   - Booking appears in `/my/bookings` with status **Confirmed**

#### 4.2 Realtime Update (Bug #1 Fix)
1. While test4's grid is open, open test5's grid on the same location/date
2. Have test4 book another available slot
3. **Verify:** test5's grid updates automatically (within a few seconds) — the newly booked slot turns green/booked without refreshing

#### 4.3 Cancel a Booking
1. Go to `/my/bookings` as test4
2. Find the booking just created
3. Click **"Cancel"**
4. **Verify:**
   - Booking status changes to **Cancelled**
   - Slot becomes available again on the grid

---

### TEST 5: Draft Session Lifecycle (Bug #3 Fix)

> This tests that draft sessions do NOT block slots.

#### 5.1 View Draft Session on Grid
1. Log in as **test5**
2. Go to Arena Rakovski Main → slot grid for **day after tomorrow**
3. Look at the 14:00 slot on Pitch 1
4. **Verify:**
   - Slot shows as **available** (NOT booked) even though S1 "Friday Pickup Football" is a draft session at that time
   - A session badge should appear (e.g. "1 session" with Users icon) indicating a public session exists

#### 5.2 Create a Draft Session via Wizard
1. Log in as **test4**
2. Go to `/sessions/new`
3. Step 1: Pick **Football**
4. Step 2: Pick **Pitch 1** at Arena Rakovski Main
5. Step 3: Pick a date and an **available** slot
   - **Verify:** All slots shown — booked ones are greyed out and non-selectable, available ones are green-bordered
   - **Verify:** Slots with existing sessions show a session badge
6. Step 4: Fill in title "Test Draft Session", visibility "Public", max 8 players
7. Step 5 (Review):
   - **Verify:** Yellow warning banner: "This creates a draft session. The slot is NOT reserved until confirmed."
   - **Verify:** "Draft" badge shown next to title
   - **Verify:** Submit button says "Create Draft Session"
8. Click **"Create Draft Session"**
9. **Verify:**
   - Toast: "Draft session created! Confirm it to reserve the slot."
   - Redirected to `/sessions/[id]`
   - Status banner shows **Draft** (yellow)
   - "Confirm Session" button visible

#### 5.3 Draft Does NOT Block the Slot
1. Open the slot grid in another tab/browser
2. Find the slot where the draft session was created
3. **Verify:** Slot is still **available** — any user can book it

#### 5.4 Confirm a Draft Session
1. On the session detail page as the organizer (test4)
2. Click **"Confirm Session"**
3. **Verify:**
   - Toast: "Session confirmed and slot reserved"
   - Status changes from Draft → **Active** (green)
   - A booking is now created for this slot
   - The slot on the grid now shows as **booked**
   - "Confirm Session" button disappears

#### 5.5 Another Booking Takes the Slot Before Confirmation
1. Create a new draft session on an available slot
2. In a second browser as test5, book that same slot with a regular booking
3. **Verify:**
   - test5's regular booking succeeds (slot is booked)
   - The draft session is auto-cancelled with `cancelled_reason = 'slot_taken'`
   - On the session detail page: status shows **Cancelled** with message about slot being taken

---

### TEST 6: Session Auto-Cancel Deadline (Bug #4 Fix)

#### 6.1 Verify Deadline Display
1. Create a new draft session
2. **Verify:** Session detail page shows confirmation deadline (session start time minus 2 hours)

#### 6.2 Test Auto-Cancel (Manual Trigger)
1. In **Supabase SQL Editor**, run:
   ```sql
   -- Create a session with deadline in the past for testing
   INSERT INTO group_sessions (
     field_id, organizer_id, sport_category_id,
     title, visibility, date, start_time, end_time,
     max_participants, current_participants,
     is_confirmed, confirmation_deadline
   ) VALUES (
     '00000000-0000-0000-0003-000000000001',
     '00000000-0000-0000-0000-000000000004',
     (SELECT id FROM sport_categories WHERE slug = 'football'),
     'Auto-Cancel Test Session',
     'public', CURRENT_DATE, '00:00', '01:00',
     10, 1,
     false,
     now() - INTERVAL '1 hour'
   );
   ```
2. Trigger the auto-cancel manually:
   ```sql
   SELECT auto_cancel_expired_sessions();
   ```
3. **Verify:**
   ```sql
   SELECT title, is_cancelled, cancelled_reason
   FROM group_sessions
   WHERE title = 'Auto-Cancel Test Session';
   -- Expected: is_cancelled = true, cancelled_reason = 'deadline_expired'
   ```

#### 6.3 Test API Cron Endpoint
1. In terminal, run:
   ```bash
   curl http://localhost:3000/api/cron/auto-cancel
   ```
2. **Verify:** Response: `{"ok":true,"method":"rpc"}` or `{"ok":true,"method":"direct_query","cancelled":0}`

---

### TEST 7: Public Session Listing & Join Flow (Bug #5 Fix)

#### 7.1 Public Sessions Page
1. Visit `/sessions` (logged in or not)
2. **Verify:**
   - Lists public sessions: "Friday Pickup Football" (Draft), "Morning Football League" (Active)
   - Each card shows a status badge (Draft/Active/Completed/Cancelled)
   - Cancelled session (Tennis Doubles) is visible but marked as Cancelled
   - Private session (S5) is NOT listed

#### 7.2 Session Badge on Slot Grid
1. Go to Arena Rakovski Main → slot grid for **day after tomorrow**
2. **Verify:** 14:00 slot on Pitch 1 shows a session badge (Users icon + "1 session") for draft session S1

#### 7.3 Join Session from Booking Modal
1. Log in as **test3** (Maria, who is not a participant in S1)
2. Go to the slot grid, click the 14:00 slot on Pitch 1 (day after tomorrow)
3. Booking modal opens
4. Click the **"Join Session"** tab
5. **Verify:** "Friday Pickup Football" is listed with organizer name, participant count, skill range
6. Click **"Request to Join"**
7. **Verify:** Toast: "Request sent" or similar

#### 7.4 Join Session from Detail Page
1. As test3, go to `/sessions/[S1-id]` (or click through from `/sessions` page)
2. **Verify:** "Request to Join" button is visible
3. Click it
4. **Verify:** Button changes to indicate request is pending

#### 7.5 Organizer Approves Join Request
1. Log in as **test4** (organizer of S1)
2. Go to `/sessions/[S1-id]`
3. **Verify:** "Pending Join Requests" section visible, showing test3 and test5 (test5 was seeded as requested)
4. Click **"Approve"** next to test3's request
5. **Verify:**
   - test3 status changes to "Confirmed"
   - Participant count increments

#### 7.6 Organizer Declines Join Request
1. Still as test4 on S1 detail page
2. Click **"Decline"** next to test5's request
3. **Verify:** test5 is removed from pending requests, status shows "Declined"

---

### TEST 8: Session Detail & Organizer Actions

#### 8.1 View Session Detail
1. Go to `/sessions/[S2-id]` (Morning Football League)
2. **Verify:**
   - Status: **Active** (green banner)
   - Organizer: Elena Todorova
   - Participants: 3/10
   - Field, date, time, sport info displayed

#### 8.2 Edit Session (Organizer)
1. Log in as **test5** (organizer of S2)
2. Go to S2 detail page
3. Click **"Edit"**
4. **Verify:** Inline edit form appears with title, description, max participants, price, skill range
5. Change the title to "Morning Football League - Updated"
6. Click **"Save"**
7. **Verify:** Title updates, toast confirms save

#### 8.3 Cancel Session (Organizer)
1. Still as test5, go to S2 detail page
2. Click **"Cancel Session"**
3. **Verify:**
   - Status changes to **Cancelled**
   - Associated booking is also cancelled
   - Slot becomes available on the grid again

#### 8.4 Mark Session Complete
1. For the completed session S3, verify it already shows as **Completed**
2. To test manually: create a new session, confirm it, then as organizer click **"Mark Complete"**
3. **Verify:** Status changes to **Completed**, "Rate Players" section may appear

---

### TEST 9: My Sessions & My Bookings

#### 9.1 My Sessions Page
1. Log in as **test4**
2. Go to `/my/sessions`
3. **Verify:**
   - **Upcoming tab:** Shows S1 (Draft) with Draft status badge
   - **Pending tab:** Shows any sessions where test4 has `requested` status
   - **Past tab:** Shows S3 (Completed) with Completed status badge
   - Each card shows participant status badge for this user

#### 9.2 My Bookings Page
1. Go to `/my/bookings`
2. **Verify:**
   - Shows bookings for test4 (tomorrow 08:00 on Pitch 1, padel court booking)
   - All bookings show status **Confirmed** (no "Pending" status exists)
   - Cancel button available on upcoming bookings

---

### TEST 10: Dashboard — Club Admin

#### 10.1 Access Dashboard
1. Log in as **test2** (club_admin of Arena Rakovski)
2. Go to `/dashboard`
3. **Verify:** Dashboard loads with overview, sidebar links

#### 10.2 Bookings Management
1. Go to `/dashboard/bookings`
2. **Verify:**
   - Table shows all bookings for Arena Rakovski's fields
   - Filters: status, date range, search
   - Actions: Complete, Cancel (for confirmed bookings)
   - No "Pending" status in the filter dropdown

#### 10.3 Group Sessions Management
1. Go to `/dashboard/group-sessions`
2. **Verify:**
   - Table shows all group sessions for Arena Rakovski's fields
   - Columns: Title, Date/Time, Field, Location, Organizer, Participants, Visibility, Status, Pending Requests
   - Filters: search, location, sport, status (Draft/Active/Completed/Cancelled/Expired), visibility, date range
   - S1 shows "Draft" status with pending request count
   - S2 shows "Active" status
   - S3 shows "Completed" status
   - **Actions:** "View Detail" (external link icon), "Confirm" (green checkmark for drafts), "Cancel" (red ban icon for draft/active)

#### 10.4 Confirm Session from Dashboard
1. Find S1 (Friday Pickup Football) in the table
2. Click the green confirm icon
3. **Verify:** Status changes to "Active", slot is now reserved

#### 10.5 Locations & Fields
1. Go to `/dashboard/locations`
2. **Verify:** Shows Arena Rakovski Main and Arena Rakovski South
3. Click into a location → see fields listed
4. Click into a field → see booking settings, attributes, schedule

---

### TEST 11: Admin Panel (Super Admin)

#### 11.1 Impersonation
1. Log in as **test1** (super_admin)
2. Go to `/admin`
3. **Verify:** Admin panel with clubs, sport categories, users tabs
4. Select "Arena Rakovski" from the club selector dropdown
5. Navigate to `/dashboard`
6. **Verify:** Impersonation banner visible, seeing Arena Rakovski's data

#### 11.2 Sport Categories Management
1. Go to `/admin/sport-categories`
2. **Verify:** All 20 sport categories listed with icons

#### 11.3 Users Management
1. Go to `/admin/users`
2. **Verify:** All 6 test users listed with roles

---

### TEST 12: Ratings & Rankings

#### 12.1 View Rankings
1. Log in as **test4**
2. Go to `/my/rankings`
3. **Verify:** Football ranking shown (based on seeded ratings from S3)

#### 12.2 Player Profiles
1. Go to `/players`
2. **Verify:** Player listing shows test4 and test5 (who have ratings)
3. Click into a player profile
4. **Verify:** Ranking breakdown visible with skill, sportsmanship scores

#### 12.3 Rate Players (After Completed Session)
1. Go to the completed session S3 detail page
2. **Verify:** "Rate Players" section visible (for participants who haven't been rated yet)
3. Rate a player you haven't rated yet
4. **Verify:** Rating submitted, ranking updates

---

### TEST 13: Realtime Slot Updates

#### 13.1 Two-Browser Test
1. Open Browser A: log in as test4, navigate to Arena Rakovski Main slot grid for a future date
2. Open Browser B: log in as test5, navigate to the same location and date
3. In Browser B: book an available slot
4. **Verify in Browser A:** Within 2-5 seconds, the slot updates from "available" to "booked" WITHOUT manual refresh

#### 13.2 Session Creation Realtime
1. Browser A: viewing the slot grid
2. Browser B: create a draft session on an available slot via `/sessions/new`
3. **Verify in Browser A:** Session badge appears on the slot (may need the session to be public)

---

### TEST 14: Private Sessions (Invite Only)

#### 14.1 Private Session Not Listed
1. Go to `/sessions` (public listing)
2. **Verify:** S5 "Private Training Match" does NOT appear

#### 14.2 Invite Flow
1. Log in as **test5** (organizer of S5)
2. Go to S5 detail page
3. **Verify:** test4 listed as "Invited" in participants
4. Use invite modal to invite another user by email

---

### TEST 15: New Session Wizard — Full Flow

#### 15.1 Slot Display
1. Log in as any user
2. Go to `/sessions/new`
3. Pick Football → Pick Pitch 1 → Pick tomorrow's date
4. **Verify:**
   - 08:00 slot shows as **greyed out** (booked by test4) — NOT selectable
   - 10:00 slot shows as **greyed out** (booked by test5)
   - 12:00 slot on Pitch 2 shows as greyed out if that field is selected
   - Available slots have green border and price
   - Slots with existing sessions show session badge (Users icon + count)
   - Tooltips on greyed-out slots explain why they're blocked

#### 15.2 Complete the Wizard
1. Select an available slot
2. Fill in details → Review step
3. **Verify:** "Draft" badge and yellow warning about slot not being reserved
4. Submit
5. **Verify:** Redirected to session detail page with Draft status

---

### TEST 16: Edge Cases

#### 16.1 Double-Booking Prevention
1. In Browser A: open booking modal on an available slot
2. In Browser B: quickly book that same slot
3. In Browser A: try to submit the booking
4. **Verify:** Error message: "SLOT_ALREADY_BOOKED" or similar — booking fails gracefully

#### 16.2 Booking Modal — Two Tabs
1. Click an available slot that also has a public session
2. **Verify:** Booking modal opens with two tabs:
   - **"Book Directly"** — regular booking form + option to create session
   - **"Join Session"** — lists the public session(s) with "Request to Join" buttons

#### 16.3 Cancelled Booking Frees Slot
1. Book a slot
2. Cancel it
3. **Verify:** Slot returns to "available" state, can be booked again by anyone

#### 16.4 Session Visibility Rules
- Public session: visible on `/sessions`, on the slot grid badge, and via booking modal "Join Session" tab
- Private session: NOT visible on `/sessions` or slot grid — only accessible to organizer and invited participants via direct link

---

## QUICK REFERENCE: URLs TO TEST

| URL | What to test |
|-----|-------------|
| `/` | Homepage, sport icons, hero search |
| `/auth/login` | Login with test accounts |
| `/sports/football/clubs` | Club listing for football |
| `/clubs/arena-rakovski` | Club detail, location list |
| `/sessions` | Public session listing |
| `/sessions/new` | Create session wizard |
| `/sessions/[id]` | Session detail, status banner, actions |
| `/my/bookings` | User's bookings |
| `/my/sessions` | User's sessions (Upcoming/Pending/Past) |
| `/my/profile` | User profile edit |
| `/my/rankings` | User's sport rankings |
| `/players` | Player leaderboard |
| `/players/[id]` | Player profile with rankings |
| `/dashboard` | Club admin overview |
| `/dashboard/bookings` | Booking management table |
| `/dashboard/group-sessions` | Session management table |
| `/dashboard/locations` | Location management |
| `/dashboard/team` | Team management |
| `/dashboard/settings` | Club settings |
| `/admin` | Super admin panel |
| `/admin/clubs` | Club management + impersonation |
| `/admin/sport-categories` | Sport category management |
| `/admin/users` | User management |
| `/api/cron/auto-cancel` | Cron endpoint for expired sessions |

---

## TROUBLESHOOTING

### "Login doesn't work with seed users" / "Database error querying schema"
The seed inserts users directly into `auth.users`. If login fails:

1. **Check users exist:** Go to Supabase Dashboard → Authentication → Users. You should see 6 users.
2. **If users don't appear or login fails**, the bcrypt hash may be incompatible with your Supabase version. Fix:
   ```sql
   -- In Supabase SQL Editor, update all test user passwords:
   UPDATE auth.users SET encrypted_password = crypt('Test1234!', gen_salt('bf'))
   WHERE email LIKE 'test%@sportly.dev';
   ```
3. **Alternative approach:** Skip the auth user inserts entirely, register users through the app's `/auth/register` page, then promote them:
   ```sql
   UPDATE profiles SET role = 'super_admin' WHERE email = 'test1@sportly.dev';
   UPDATE profiles SET role = 'club_admin' WHERE email = 'test2@sportly.dev';
   UPDATE profiles SET role = 'staff' WHERE email = 'test3@sportly.dev';
   UPDATE profiles SET role = 'trainer' WHERE email = 'test6@sportly.dev';
   -- test4 and test5 stay as 'client' (default)
   ```
   Then manually insert the club_members, bookings, sessions, etc. from the seed.

### "Slot grid shows no fields"
- Check that `field_booking_settings` has entries for all fields
- Check that `location_schedules` has entries (the grid uses these for open/close hours)
- Check that fields have `is_active = true`

### "Realtime not working"
- Verify replication is enabled for `bookings` and `group_sessions` in Supabase Dashboard → Database → Replication
- Check browser console for WebSocket connection errors
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly

### "pg_cron error when running schema"
- Make sure pg_cron extension is enabled BEFORE running the schema
- If the extension isn't available, the Vercel Cron fallback (`/api/cron/auto-cancel`) handles auto-cancellation instead
