# SPORTLY — IMPLEMENTATION GUIDE

> Step-by-step instructions to build Sportly from the `nextjs/saas-starter` template with Supabase.
> Companion to `SPORTLY-BLUEPRINT.md`. This file tells you WHAT to do. The blueprint tells you WHY and WHAT to build.
> Feed both files to Cursor.

---

# TABLE OF CONTENTS

- [PHASE 0: Project Setup & Starter Cleanup](#phase-0-project-setup--starter-cleanup)
- [PHASE 1: Supabase Integration](#phase-1-supabase-integration)
- [PHASE 2: Database Schema](#phase-2-database-schema)
- [PHASE 3: Authentication](#phase-3-authentication)
- [PHASE 4: Layouts, Navigation & Impersonation](#phase-4-layouts-navigation--impersonation)
- [PHASE 5: Super Admin Pages](#phase-5-super-admin-pages)
- [PHASE 6: Club Dashboard — Locations & Fields](#phase-6-club-dashboard--locations--fields)
- [PHASE 7: Booking Engine](#phase-7-booking-engine)
- [PHASE 8: Public Pages](#phase-8-public-pages)
- [PHASE 9: Group Sessions (Draft Lifecycle)](#phase-9-group-sessions-draft-lifecycle)
- [PHASE 10: Rankings & Ratings](#phase-10-rankings--ratings)
- [PHASE 11: Polish & Production](#phase-11-polish--production)

---

# PHASE 0: PROJECT SETUP & STARTER CLEANUP

## 0.1 Clone and Install

```bash
git clone https://github.com/nextjs/saas-starter sportly
cd sportly
pnpm install
```

## 0.2 Understand What the Starter Gives You

The `nextjs/saas-starter` template comes with:

```
├── app/
│   ├── (dashboard)/           # Protected dashboard pages (settings, teams, general, activity, security)
│   ├── (login)/               # Sign-in and sign-up pages
│   ├── api/stripe/            # Stripe webhook handler
│   ├── pricing/               # Pricing page
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Marketing landing page
├── components/ui/             # shadcn/ui components (button, input, card, etc.)
├── lib/
│   ├── auth/                  # JWT session management (session.ts)
│   ├── db/
│   │   ├── drizzle.ts         # Drizzle ORM connection (postgres-js driver)
│   │   ├── schema.ts          # Drizzle schema: users, teams, teamMembers, activityLogs, invitations
│   │   ├── queries.ts         # DB query functions
│   │   ├── seed.ts            # Seed script
│   │   ├── setup.ts           # DB setup script
│   │   └── migrations/        # Drizzle migration SQL files
│   ├── payments/              # Stripe integration
│   └── utils.ts               # Utility helpers
├── drizzle.config.ts          # Drizzle config (points to POSTGRES_URL)
├── middleware.ts               # Next.js middleware (auth route protection)
└── package.json               # Uses pnpm, scripts: db:setup, db:migrate, db:seed, db:studio
```

**What we KEEP:**
- Next.js App Router setup, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`
- `components/ui/` (shadcn/ui base components)
- Drizzle ORM setup pattern (but we'll reconfigure it for Supabase)
- `middleware.ts` pattern (but rewrite for Supabase Auth)
- Tailwind + shadcn/ui configuration

**What we REMOVE or REPLACE:**
- The entire auth system (JWT cookies → Supabase Auth)
- Stripe integration (remove for now, can add back later)
- Existing Drizzle schema (users, teams, teamMembers, activityLogs → our Sportly schema)
- All existing pages under `app/` (replace with Sportly routes)
- `lib/payments/` (Stripe)
- `lib/auth/session.ts` (custom JWT → Supabase)
- The `POSTGRES_URL` env var (→ Supabase `DATABASE_URL`)

## 0.3 Cleanup Script

Run these steps to strip the starter down to a clean shell:

```bash
# 1. Remove Stripe
rm -rf lib/payments
rm -rf app/api/stripe
rm -rf app/pricing

# 2. Remove existing auth (we'll replace with Supabase)
rm -rf lib/auth

# 3. Remove existing page content (keep layout.tsx for now)
rm -rf app/\(dashboard\)
rm -rf app/\(login\)

# 4. Clear the existing Drizzle schema (we'll write our own)
# Don't delete the folder — just empty the files
echo "" > lib/db/schema.ts
echo "" > lib/db/queries.ts
echo "" > lib/db/seed.ts
rm -rf lib/db/migrations/*

# 5. Remove Stripe env references from .env / .env.example
# Manually edit .env to remove STRIPE_* variables

# 6. Clean up the root page (we'll rebuild the landing page)
echo 'export default function HomePage() { return <div>Sportly</div> }' > app/page.tsx
```

## 0.4 Install New Dependencies

```bash
# Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# Additional shadcn/ui components we'll need
pnpm dlx shadcn@latest add dialog sheet dropdown-menu popover command \
  table tabs avatar separator skeleton calendar toast form switch \
  checkbox radio-group alert progress tooltip scroll-area badge textarea select

# Date utilities
pnpm add date-fns

# Zod for validation (may already be in starter)
pnpm add zod
```

## 0.5 Create Environment File

Create/update `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Supabase Postgres connection string)
# Used by Drizzle ORM for migrations and direct queries
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 0.6 Verify Clean Slate

```bash
pnpm dev
# Should start without errors, show "Sportly" text at localhost:3000
```

---

# PHASE 1: SUPABASE INTEGRATION

## 1.1 Create Supabase Project

1. Go to https://supabase.com → New Project
2. Name it "sportly", choose region closest to your users
3. Save the project URL, anon key, and service role key to `.env.local`
4. Go to Settings → Database → Connection String → copy the URI for `DATABASE_URL`

## 1.2 Create Supabase Client Files

### `lib/supabase/client.ts` (browser client — used in Client Components)

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `lib/supabase/server.ts` (server client — used in Server Components, Server Actions, Route Handlers)

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component
            // where cookies can't be set. This can be ignored if
            // middleware is refreshing sessions.
          }
        },
      },
    }
  );
}
```

### `lib/supabase/admin.ts` (service role client — server-only, bypasses RLS)

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

## 1.3 Reconfigure Drizzle for Supabase

Update `lib/db/drizzle.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

Update `drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

# PHASE 2: DATABASE SCHEMA

## 2.1 Important: Supabase Auth Tables vs Our Tables

Supabase manages `auth.users` automatically. Our app tables live in the `public` schema. We create a `profiles` table that references `auth.users` via a trigger.

**There are TWO ways to create the schema:**
- **Option A (Recommended for speed):** Run raw SQL directly in Supabase SQL Editor
- **Option B:** Define in Drizzle schema.ts and push with `drizzle-kit push`

**We'll use BOTH.** Triggers and RLS policies must be created via SQL in Supabase. Tables can be defined in Drizzle for type safety.

## 2.2 Step 1: Run SQL in Supabase SQL Editor

Go to Supabase Dashboard → SQL Editor → New Query. Run ALL of the following SQL from the blueprint (Section 4) in this order:

```
1. Create all ENUM types (including 'requested' in session_participant_status)
2. Create all tables (profiles, sport_categories, clubs, club_members, locations, location_schedules,
   location_images, fields, field_attributes, field_booking_settings, field_availability,
   bookings, group_sessions, session_participants, session_invites,
   user_sport_rankings, user_ratings, rating_criteria, user_rating_details)
3. Create all indexes (including idx_sessions_confirmed, idx_sessions_deadline, idx_session_participants_status)
4. Create the handle_new_user() trigger (auto-creates profile on signup)
5. Create the update_sport_ranking() trigger (auto-updates rankings on rating)
6. Create the update_session_participant_count() trigger
7. Create the create_booking_safe() function (with range overlap check)
8. Create the cancel_draft_sessions_on_booking() trigger (auto-cancels draft sessions when slot is booked)
9. Create the auto_cancel_expired_sessions() function (for pg_cron)
10. Schedule pg_cron job: auto-cancel-expired-sessions every 15 minutes
11. Enable RLS on ALL tables
12. Create RLS policies for each table
13. Insert seed data (sport categories, rating criteria)
```

> CRITICAL: Copy the complete SQL from SPORTLY-BLUEPRINT.md Section 4. Every CREATE TABLE, CREATE INDEX, CREATE TRIGGER, CREATE FUNCTION, and INSERT statement.
>
> NOTE: The `group_sessions` table now has 3 new columns: `is_confirmed` (BOOLEAN DEFAULT false), `confirmation_deadline` (TIMESTAMPTZ), `cancelled_reason` (TEXT). The `bookings.status` default is `'confirmed'` (not `'pending'`). The `session_participant_status` enum includes `'requested'`.

## 2.3 Step 2: Mirror Schema in Drizzle

Write `lib/db/schema.ts` to mirror the Supabase tables for type-safe queries in your app code. This file does NOT create the tables (Supabase SQL already did that) — it just gives Drizzle type information.

```typescript
// lib/db/schema.ts
import {
  pgTable, pgEnum, uuid, text, boolean, integer, decimal,
  timestamp, time, date, uniqueIndex, index
} from 'drizzle-orm/pg-core';

// ─── ENUMS ────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', [
  'super_admin', 'club_admin', 'staff', 'trainer', 'client'
]);
export const sessionVisibilityEnum = pgEnum('session_visibility', ['public', 'private']);
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending', 'confirmed', 'cancelled', 'completed'
]);
export const dayOfWeekEnum = pgEnum('day_of_week', [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]);
export const participantStatusEnum = pgEnum('session_participant_status', [
  'invited', 'requested', 'confirmed', 'declined', 'waitlisted'
]);

// ─── TABLES ───────────────────────────────────────
// Define each table matching the SQL exactly.
// See SPORTLY-BLUEPRINT.md Section 4 for all column definitions.
// Export each table for use in queries.

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  city: text('city'),
  role: userRoleEnum('role').notNull().default('client'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const sportCategories = pgTable('sport_categories', { /* ... all columns ... */ });
export const clubs = pgTable('clubs', { /* ... */ });
export const clubMembers = pgTable('club_members', { /* ... */ });
export const locations = pgTable('locations', { /* ... */ });
export const locationSchedules = pgTable('location_schedules', { /* ... */ });
export const locationImages = pgTable('location_images', { /* ... */ });
export const fields = pgTable('fields', { /* ... */ });
export const fieldAttributes = pgTable('field_attributes', { /* ... */ });
export const fieldBookingSettings = pgTable('field_booking_settings', { /* ... */ });
export const fieldAvailability = pgTable('field_availability', { /* ... */ });
export const bookings = pgTable('bookings', { /* ... status DEFAULT 'confirmed' ... */ });
export const groupSessions = pgTable('group_sessions', {
  /* ... all existing columns ...
   * NEW: isConfirmed: boolean('is_confirmed').default(false),
   * NEW: confirmationDeadline: timestamp('confirmation_deadline', { withTimezone: true }),
   * NEW: cancelledReason: text('cancelled_reason'),
   */
});
export const sessionParticipants = pgTable('session_participants', { /* ... */ });
export const sessionInvites = pgTable('session_invites', { /* ... */ });
export const userSportRankings = pgTable('user_sport_rankings', { /* ... */ });
export const userRatings = pgTable('user_ratings', { /* ... */ });
export const ratingCriteria = pgTable('rating_criteria', { /* ... */ });
export const userRatingDetails = pgTable('user_rating_details', { /* ... */ });

// NOTE: Fill in EVERY column for each table exactly matching the SQL.
// The comments above are placeholders — expand them fully.
```

> IMPORTANT: Cursor should expand each table definition with ALL columns from the blueprint SQL.
> This is critical for TypeScript type inference.

## 2.4 Step 3: Generate Drizzle Introspection (optional but useful)

```bash
pnpm drizzle-kit introspect
```

This reads your live Supabase DB and generates a Drizzle schema — useful to verify your `schema.ts` matches reality.

## 2.5 Step 4: Create Comprehensive Seed Script

Create `lib/db/seed.sql` — a comprehensive SQL seed script that populates the database with realistic test data. This script should be runnable via Supabase SQL Editor or `psql`.

**The seed script MUST include:**

1. **Test authentication users** (5-6 users with known credentials):
   ```
   test1@sportly.dev / Test1234!   → super_admin
   test2@sportly.dev / Test1234!   → club_admin
   test3@sportly.dev / Test1234!   → staff
   test4@sportly.dev / Test1234!   → client (regular user)
   test5@sportly.dev / Test1234!   → client (regular user)
   test6@sportly.dev / Test1234!   → trainer
   ```
   Use `supabase.auth.admin.createUser()` or raw SQL inserts into `auth.users` with pre-hashed passwords.

2. **Sport categories** — all 20 from the blueprint.

3. **Rating criteria** — Skill, Sportsmanship, Teamwork, Punctuality.

4. **Clubs** (2-3 clubs):
   - "Arena Rakovski" (Sofia), "Sportify Center" (Plovdiv), etc.

5. **Club members** — assign test users to clubs with appropriate roles.

6. **Locations** (2-3 per club) with full weekly schedules (`location_schedules`).

7. **Fields** (2-4 per location) with:
   - `field_booking_settings` (various slot durations, prices)
   - `field_attributes` (surface, lighting, etc.)
   - `field_availability` rules

8. **Bookings** — mix of confirmed bookings on various fields/dates.

9. **Group sessions** in various states:
   - Draft sessions (`is_confirmed=false`, `booking_id=NULL`)
   - Confirmed/Active sessions (`is_confirmed=true`, `booking_id` set)
   - Completed sessions (`completed_at` set)
   - Cancelled sessions (`is_cancelled=true`, various `cancelled_reason` values)

10. **Session participants** with various statuses:
    - `confirmed`, `requested`, `invited`, `waitlisted`

11. **Initial ratings** — a few user_ratings entries to verify ranking triggers work.

Additionally, keep `lib/db/seed.ts` as a lightweight TypeScript wrapper that reads and executes the SQL seed file:

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';

async function seed() {
  const sql = postgres(process.env.DATABASE_URL!);
  const seedSql = readFileSync(resolve(__dirname, 'seed.sql'), 'utf-8');
  await sql.unsafe(seedSql);
  console.log('Seed complete');
  await sql.end();
}

seed();
```

Run: `pnpm db:seed`

## 2.6 Step 5: Create Reusable Query Helpers

Create `lib/db/queries.ts` with typed query helpers that are used across server actions:

```typescript
// ─── Session Status Helper ─────────────────────────
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

// ─── Reusable Select Shapes ────────────────────────
// Define common .select() shapes to avoid repeating column lists everywhere.
// Example:
export const SESSION_SELECT = `
  id, field_id, booking_id, organizer_id, sport_category_id,
  title, description, visibility, date, start_time, end_time,
  max_participants, current_participants,
  price_per_person_eur, price_per_person_local,
  skill_level_min, skill_level_max,
  is_confirmed, confirmation_deadline, cancelled_reason,
  is_cancelled, completed_at, created_at
` as const;

// ─── Availability Check Helper ─────────────────────
export function canRequestToJoin(session: {
  visibility: string;
  is_cancelled: boolean;
  current_participants: number;
  max_participants: number;
}): boolean {
  return (
    session.visibility === 'public' &&
    !session.is_cancelled &&
    session.current_participants < session.max_participants
  );
}
```

## 2.7 Step 6: Create First Super Admin

After the database is set up:

1. Run the seed script — it creates test users including a super_admin (`test1@sportly.dev`)
2. Alternatively: register a user through the app, then change their `role` to `super_admin` in Supabase Table Editor
3. This user can now access `/admin`

---

# PHASE 3: AUTHENTICATION

## 3.1 Rewrite Middleware

Replace `middleware.ts` entirely:

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session (important!)
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users from protected routes
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/my');

  if (!user && isProtected) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && (path.startsWith('/auth/login') || path.startsWith('/auth/register'))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/my/:path*',
    '/auth/:path*',
  ],
};
```

## 3.2 Create Auth Helper Library

Create `lib/auth/helpers.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireAuth();
  if (user.role !== 'super_admin') redirect('/');
  return user;
}

export async function getCurrentUserWithClubRole(clubId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .single();

  return { ...user, clubRole: membership?.role ?? null };
}

export async function requireClubAccess(clubId: string) {
  const user = await requireAuth();

  // Super admins have full access when impersonating
  if (user.role === 'super_admin') return { ...user, clubRole: 'club_admin' as const };

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .single();

  if (!membership) redirect('/');
  return { ...user, clubRole: membership.role };
}
```

## 3.3 Create Impersonation Helpers

Create `lib/auth/impersonation.ts`:

```typescript
import { cookies } from 'next/headers';
import { getCurrentUser } from './helpers';
import { createClient } from '@/lib/supabase/server';

// ─── Club Impersonation (Super Admin → Club) ──────
export async function setImpersonatedClub(clubId: string) {
  const cookieStore = await cookies();
  cookieStore.set('impersonated_club_id', clubId, {
    httpOnly: true, path: '/', maxAge: 60 * 60 * 8, sameSite: 'lax',
  });
}

export async function getImpersonatedClubId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('impersonated_club_id')?.value ?? null;
}

export async function clearImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete('impersonated_club_id');
}

// ─── Location Scoping (Club Admin → Location) ─────
export async function setActiveLocation(locationId: string | null) {
  const cookieStore = await cookies();
  if (locationId) {
    cookieStore.set('active_location_id', locationId, { path: '/', maxAge: 60 * 60 * 24 });
  } else {
    cookieStore.delete('active_location_id');
  }
}

export async function getActiveLocationId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('active_location_id')?.value ?? null;
}

// ─── Get Active Club (universal) ───────────────────
export async function getActiveClubId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  // Super admin: use impersonation cookie
  if (user.role === 'super_admin') {
    return await getImpersonatedClubId();
  }

  // Regular club member: get their first club
  const supabase = await createClient();
  const { data } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single();

  return data?.club_id ?? null;
}
```

## 3.4 Create Auth Pages

### Route structure:
```
app/
├── (auth)/
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── callback/route.ts
```

### `app/(auth)/auth/login/page.tsx`

Build a login form using shadcn/ui `Input`, `Button`, `Card`. On submit:

```typescript
'use client';
import { createClient } from '@/lib/supabase/client';

async function handleLogin(email: string, password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { /* show error */ }
  else { window.location.href = '/'; /* or redirect param */ }
}
```

### `app/(auth)/auth/register/page.tsx`

```typescript
async function handleRegister(email: string, password: string, fullName: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  if (error) { /* show error */ }
  else { /* show "check email" or redirect */ }
}
```

### `app/(auth)/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
```

## 3.5 Post-Login Redirect Logic

After login, determine where to send the user. Create a server action or API route:

```typescript
// lib/auth/redirect.ts
export async function getPostLoginRedirect(userId: string): Promise<string> {
  const supabase = await createClient();

  // Check global role
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', userId).single();

  if (profile?.role === 'super_admin') return '/admin';

  // Check club membership
  const { data: membership } = await supabase
    .from('club_members').select('club_id')
    .eq('user_id', userId).eq('is_active', true).limit(1).single();

  if (membership) return '/dashboard';

  return '/'; // Client landing page
}
```

---

# PHASE 4: LAYOUTS, NAVIGATION & IMPERSONATION

## 4.1 Create Route Groups

Create all route group folders and stub pages:

```bash
# Auth
mkdir -p app/\(auth\)/auth/login app/\(auth\)/auth/register app/\(auth\)/auth/callback

# Public
mkdir -p app/\(public\)/sports/\[category\]/clubs
mkdir -p app/\(public\)/clubs/\[clubSlug\]
mkdir -p app/\(public\)/sessions/\[id\]
mkdir -p app/\(public\)/sessions/new
mkdir -p app/\(public\)/players/\[id\]
mkdir -p app/\(public\)/my/bookings app/\(public\)/my/sessions app/\(public\)/my/rankings app/\(public\)/my/profile

# Dashboard (Club Admin)
mkdir -p app/\(dashboard\)/dashboard/locations/new
mkdir -p app/\(dashboard\)/dashboard/locations/\[id\]/fields/new
mkdir -p app/\(dashboard\)/dashboard/locations/\[id\]/fields/\[fieldId\]
mkdir -p app/\(dashboard\)/dashboard/bookings
mkdir -p app/\(dashboard\)/dashboard/group-sessions
mkdir -p app/\(dashboard\)/dashboard/team
mkdir -p app/\(dashboard\)/dashboard/settings

# Admin (Super Admin)
mkdir -p app/\(admin\)/admin/clubs app/\(admin\)/admin/sport-categories app/\(admin\)/admin/users
```

Create stub `page.tsx` files in each leaf folder:

```typescript
// Example stub: app/(admin)/admin/clubs/page.tsx
export default function ClubsPage() {
  return <div>Clubs Management</div>;
}
```

## 4.2 Build Layout Components

### `components/layout/app-shell.tsx`
Reusable shell with sidebar + top bar + content area. Accept `sidebar` and `topBar` as props.

### `components/layout/dashboard-sidebar.tsx`
Links: Overview, Locations, Bookings, Group Sessions, Team, Settings. Use `lucide-react` icons.

### `components/layout/admin-sidebar.tsx`
Links: Clubs, Sport Categories, Users.

### `components/layout/public-navbar.tsx`
Sport icon bar at top + main nav (Clubs, Players, News, Create Your Club) + auth buttons.

### `components/layout/sport-icon-bar.tsx`
Horizontal scrollable row of sport icons. Fetched from `sport_categories` table. Active sport highlighted based on route.

### `components/layout/impersonation-banner.tsx`
Yellow banner: "⚠️ Viewing as: [Club Name] | [Exit Impersonation]".
Shown only when `impersonated_club_id` cookie is set and user is super_admin.

### `components/layout/location-selector.tsx`
Dropdown in dashboard top bar. Lists all locations for the active club + "All Locations" option.
On change: calls `setActiveLocation` server action → `router.refresh()`.

### `components/layout/club-selector.tsx`
Combobox in admin top bar. Lists all clubs. On select: calls `impersonateClub` server action → redirect to `/dashboard`.

## 4.3 Create Layouts

### `app/(admin)/layout.tsx`

```typescript
import { requireSuperAdmin } from '@/lib/auth/helpers';
import AdminSidebar from '@/components/layout/admin-sidebar';
import ImpersonationBanner from '@/components/layout/impersonation-banner';
import ClubSelector from '@/components/layout/club-selector';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  // Fetch all clubs for the selector
  // Render: ImpersonationBanner + AppShell with AdminSidebar + ClubSelector in top bar
}
```

### `app/(dashboard)/layout.tsx`

```typescript
import { requireAuth } from '@/lib/auth/helpers';
import { getActiveClubId, getActiveLocationId } from '@/lib/auth/impersonation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/'); // No club context

  const activeLocationId = await getActiveLocationId();
  // Fetch club info + locations for selector
  // Render: ImpersonationBanner + AppShell with DashboardSidebar + LocationSelector
}
```

### `app/(public)/layout.tsx`

```typescript
import PublicNavbar from '@/components/layout/public-navbar';
import SportIconBar from '@/components/layout/sport-icon-bar';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Fetch sport categories for icon bar
  // Render: SportIconBar + PublicNavbar + children + Footer
}
```

### `app/(public)/my/layout.tsx`

```typescript
import { requireAuth } from '@/lib/auth/helpers';

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  // Tab navigation: Bookings, Sessions, Rankings, Profile
}
```

---

# PHASE 5: SUPER ADMIN PAGES

## 5.1 Sport Categories (`/admin/sport-categories`)

Create CRUD server actions in `lib/actions/admin-actions.ts`:

```typescript
'use server';

export async function createSportCategory(formData: FormData) { /* ... */ }
export async function updateSportCategory(id: string, formData: FormData) { /* ... */ }
export async function deleteSportCategory(id: string) { /* ... */ }
export async function reorderSportCategories(orderedIds: string[]) { /* ... */ }
```

Build the page with:
- Table/list of categories with inline edit
- Add button → dialog/modal form
- Drag-to-reorder (use `@dnd-kit/sortable` or simple up/down buttons)
- Toggle active/inactive
- Delete (with "X fields use this" warning if referenced)

## 5.2 Clubs (`/admin/clubs`)

Server actions: `createClub`, `updateClub`, `deleteClub`, `toggleClubActive`

Build with:
- **Impersonation Combobox** at top (search clubs, select → impersonate → redirect to `/dashboard`)
- Table: name, slug, locations count, members count, active toggle, actions
- "Create Club" → dialog: name, auto-slug, email, phone, description, logo
- After create: option to invite first club_admin

## 5.3 Users (`/admin/users`)

- Table with filters (role, search)
- Edit role in dropdown
- View club memberships

## 5.4 Impersonation Server Actions

```typescript
'use server';
import { setImpersonatedClub, clearImpersonation } from '@/lib/auth/impersonation';
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth/helpers';

export async function impersonateClub(clubId: string) {
  await requireSuperAdmin();
  await setImpersonatedClub(clubId);
  redirect('/dashboard');
}

export async function stopImpersonation() {
  await requireSuperAdmin();
  await clearImpersonation();
  redirect('/admin');
}
```

---

# PHASE 6: CLUB DASHBOARD — LOCATIONS & FIELDS

## 6.1 Server Actions for Locations

Create `lib/actions/location-actions.ts`:

```typescript
'use server';

export async function createLocation(data: {
  clubId: string;
  name: string; address: string; city: string; country?: string;
  phone?: string; email?: string; description?: string;
  schedule: { dayOfWeek: string; openTime: string; closeTime: string; isClosed: boolean }[];
}) {
  // 1. Require club admin access
  // 2. Generate slug from name
  // 3. Insert location
  // 4. Insert 7 location_schedules rows
  // 5. Return location
}

export async function updateLocation(locationId: string, data: Partial<Location>) { /* ... */ }
export async function deleteLocation(locationId: string) { /* ... */ }
```

## 6.2 Server Actions for Fields

Create `lib/actions/field-actions.ts`:

```typescript
'use server';

export async function createField(data: {
  locationId: string;
  name: string;
  sportCategoryId: string;
  description?: string;
  attributes: { key: string; value: string }[];
  bookingSettings: {
    slotDurationMinutes: number;
    bufferMinutes: number;
    pricePerSlotEur: number;
    pricePerSlotLocal?: number;
    minBookingNoticeHours: number;
    maxBookingAdvanceDays: number;
    autoConfirm: boolean;
    cancellationPolicyHours: number;
  };
  availability?: {
    dayOfWeek?: string;
    specificDate?: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }[];
}) {
  // 1. Require club admin access (verify location belongs to club)
  // 2. Generate slug
  // 3. Insert field
  // 4. Insert field_attributes (bulk)
  // 5. Insert field_booking_settings
  // 6. Insert field_availability (if provided)
  // 7. Return field
}
```

## 6.3 Build Location Wizard

`app/(dashboard)/dashboard/locations/new/page.tsx`

Use a multi-step Wizard component (`components/forms/wizard.tsx`):
- Step 1: Basic Info form
- Step 2: Weekly Schedule Editor (`components/forms/weekly-schedule-editor.tsx`)
- Step 3: Quick-Add Fields (optional, repeatable)
- Step 4: Review → Submit

## 6.4 Build Field Wizard

`app/(dashboard)/dashboard/locations/[id]/fields/new/page.tsx`

5-step wizard as described in the blueprint:
1. Basic Info (name, sport category, description)
2. Attributes (dynamic form based on standard keys)
3. Booking Settings (duration, price, notice, advance)
4. Availability (override schedule, block dates)
5. Review → Submit

## 6.5 Build Location/Field Detail Pages

Tabbed interfaces using shadcn `Tabs` component. Each tab loads different edit forms.

## 6.6 Build Bookings Page

`app/(dashboard)/dashboard/bookings/page.tsx`

- Reads `getActiveLocationId()` for filtering
- Table view with columns: date, time, field, location, client, status, price
- Filter bar: date range, status, search
- Manual booking button → modal: pick location → field → date → slot → client

## 6.7 Build Team Page

`app/(dashboard)/dashboard/team/page.tsx`

- List members of active club
- Invite modal: email + role selector
- Change role dropdown per member
- Remove button

---

# PHASE 7: BOOKING ENGINE

## 7.1 Slot Generator

Create `lib/booking/slot-generator.ts`:

```typescript
export interface SlotSession {
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

export interface TimeSlot {
  startTime: string;     // "09:00"
  endTime: string;       // "10:00"
  status: 'available' | 'booked' | 'blocked' | 'past' | 'closed';
  priceEur: number | null;
  priceLocal: number | null;
  bookingId?: string;    // set when status === 'booked'
  sessions: SlotSession[];  // public sessions overlapping this slot (empty array if none)
}

export async function getAvailableSlots(
  fieldId: string,
  date: string // YYYY-MM-DD
): Promise<TimeSlot[]> {
  // Follow the algorithm from SPORTLY-BLUEPRINT.md Section 11
  // 1. Get location schedule for this weekday
  // 2. Get field booking settings
  // 3. Validate date is within booking window
  // 4. Get field availability overrides
  // 5. Generate slot grid from open to close
  // 6. Fetch existing CONFIRMED bookings → mark as booked (range overlap: start_time < slot.endTime AND end_time > slot.startTime)
  //    NOTE: Only 'confirmed' bookings block slots. Draft sessions do NOT block.
  // 7. Mark past slots (if today)
  // 8. Fetch public group sessions for field+date (not cancelled)
  //    → Filter out sessions past confirmation_deadline (safety check)
  //    → Attach matching sessions[] to each overlapping slot
  // 9. Return slot array with sessions attached
}
```

> **Key: only confirmed bookings block slots.** Draft sessions (`is_confirmed = false`) do NOT reserve the slot. The slot remains `available` for regular bookings. The `sessions[]` array on each `TimeSlot` lets the UI show session badges and populate the "Join Session" tab of the booking modal.

## 7.2 Schedule Server Action

Create `lib/actions/schedule-actions.ts`:

```typescript
'use server';

export async function getScheduleForDate(locationId: string, date: string) {
  // 1. Get all active fields for this location
  // 2. For each field, call getAvailableSlots()
  // 3. Return array of { field, bookingSettings, slots }
}
```

## 7.3 Booking Server Actions

Create `lib/actions/booking-actions.ts`:

```typescript
'use server';

export async function createPublicBooking(data: {
  fieldId: string; date: string; startTime: string; endTime: string; notes?: string;
}) {
  // 1. Auth check
  // 2. Validate booking window (min_notice_hours, max_advance_days)
  // 3. Calculate price from booking settings
  // 4. Call create_booking_safe() — always inserts with status = 'confirmed'
  //    (range overlap check prevents double bookings)
  // 5. Trigger cancel_draft_sessions_on_booking fires automatically,
  //    cancelling any draft sessions overlapping this slot
  // 6. Return booking
}

export async function cancelBooking(bookingId: string) {
  // 1. Auth: own booking or club admin
  // 2. Check cancellation policy
  // 3. Set status = 'cancelled'
  // 4. If booking.session_id is set:
  //    → Set group_sessions.is_cancelled = true, cancelled_reason = 'manual'
  //    → Clear group_sessions.booking_id
}

export async function createManualBooking(data: {
  fieldId: string; date: string; startTime: string; endTime: string;
  clientUserId?: string; walkInName?: string; notes?: string;
}) {
  // Club admin creates booking — uses create_booking_safe(), always confirmed
}
```

> **Regular bookings are always `confirmed`.** There is no `pending` state. The `create_booking_safe()` function always inserts with `status = 'confirmed'`.

## 7.4 Safe Booking Postgres Function

Run this SQL in Supabase (also included in the master schema `lib/db/supabase-schema.sql`):

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

  -- Time range overlap check (NOT just exact start_time match)
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

> **Key improvement from old version:** The overlap check uses `start_time < p_end_time AND end_time > p_start_time` instead of exact `start_time` matching. This correctly detects overlapping bookings with different durations. The optional `p_session_id` param enables bidirectional linking when confirming a group session.

## 7.5 Build the Daily Schedule Grid Component

Create `components/booking/daily-schedule-grid.tsx`:

This is the most complex UI component. Follow SPORTLY-BLUEPRINT.md Section 10 exactly:
- Filter row (date picker, surface, indoor/outdoor, lighting dropdowns)
- Field columns with headers (number, surface, environment, lighting)
- Slot cells with session awareness:
  - `available` (no sessions) = price + duration
  - `available` (with sessions) = price + badge showing session count (e.g. "2 sessions")
  - `booked` = green block (only for confirmed bookings)
  - `blocked`, `past`, `closed`
- Click available slot → opens 2-tab booking modal, passing `slot.sessions` as props
- Responsive: single field on mobile with dropdown selector
- **Supabase Realtime subscription** (REQUIRED): subscribe to both `bookings` and `group_sessions` tables by field_id, auto-refresh schedule on changes, cleanup on unmount

Create `components/booking/slot-cell.tsx`:
- Renders a single slot in the grid
- If `slot.sessions.length > 0`, shows a badge like "N sessions" alongside the price
- Entire cell clickable → opens booking modal

Create `components/booking/booking-modal.tsx` — **2-tab design**:

**Tab 1: "Book Directly"**
- Shows booking details (field, date, time, duration, price)
- Notes field
- Optional "Create a group session (draft)" checkbox that expands to:
  - Title, description, public/private radio, max participants, price per person, skill level range
- Button: "Book Now — €50.00" (regular booking) or "Create Draft Session" (if checkbox checked)
- Regular booking → `createPublicBooking()` → confirmed immediately
- Draft session → `createGroupSession()` → redirect to session detail page

**Tab 2: "Join Session" (N)**
- Lists all public sessions from `slot.sessions` prop
- Each session card shows: title, organizer, participant count, status badge, skill range, price
- "Request to Join" button per session → `requestToJoinSession()`
- Tab badge shows count of available sessions

---

# PHASE 8: PUBLIC PAGES

## 8.1 Landing Page (`/`)

`app/(public)/page.tsx`

- Hero with search bar (city, field type, date/time)
- Stats counters (total players, total bookings from DB)
- Sport categories grid (cards linking to `/sports/[slug]`)
- New clubs carousel
- Recently registered players

## 8.2 Sport Landing (`/sports/[category]`)

- Themed hero using `sport_categories.color_primary`
- Same search bar, filtered stats, filtered clubs
- "View All Clubs" → `/sports/[category]/clubs`

## 8.3 Club Listing (`/sports/[category]/clubs`)

- Filter bar (city, field type, date/time)
- Club rows: logo, name, address, price range, "Reserve" button
- Query: join clubs → locations → fields (filtered by sport) → booking_settings (for price)

## 8.4 Club Detail (`/clubs/[clubSlug]`)

The most important public page. 4 tabs:
1. About (info, gallery, amenities, description)
2. **Daily Schedule** (the `DailyScheduleGrid` component — this is where booking happens)
3. Weekly Schedule (overview grid)
4. Trainers (list of trainers at this club)

Location picker at top if club has multiple locations.

## 8.5 Client Dashboard (`/my/*`)

- `/my/bookings` — upcoming + past bookings, cancel action. If `booking.session_id` is set, show "View Session" link.
- `/my/sessions` — sessions as organizer or participant:
  - Each card shows **status badge** (Draft/Active/Completed/Cancelled/Expired) computed via `getSessionStatus()`
  - **Organizer on draft session:** inline "Confirm" button + badge showing pending join request count
  - Past sessions: "Rate Players" button (no time limit)
- `/my/rankings` — per-sport rankings with breakdown
- `/my/profile` — edit name, avatar, phone, city

---

# PHASE 9: GROUP SESSIONS (DRAFT LIFECYCLE)

## 9.1 Session Server Actions

Create `lib/actions/session-actions.ts` — this is a major file with many actions. Follow SPORTLY-BLUEPRINT.md Section 12 exactly.

```typescript
'use server';

// ─── Create a DRAFT session (no booking, no slot reserved) ──────
export async function createGroupSession(data: {
  fieldId: string; date: string; startTime: string; endTime: string;
  title: string; description?: string; visibility: 'public' | 'private';
  maxParticipants: number; pricePerPersonEur?: number;
  skillLevelMin?: number; skillLevelMax?: number;
}) {
  // 1. Auth check
  // 2. Compute confirmation_deadline = date + startTime - 2 hours
  // 3. Insert group_session: is_confirmed=false, booking_id=NULL
  // 4. Add organizer as first participant (status: confirmed)
  // 5. Return session (redirect to detail page)
  // NOTE: No booking created. Slot NOT reserved.
}

// ─── Confirm session (reserves the slot atomically) ─────────────
export async function confirmGroupSession(sessionId: string) {
  // 1. Auth: must be organizer
  // 2. Verify: is_confirmed=false, is_cancelled=false
  // 3. Get session details (field_id, date, start_time, end_time, price)
  // 4. Call create_booking_safe(p_session_id=sessionId) to reserve slot
  // 5. Update group_sessions: is_confirmed=true, booking_id=<new booking id>
  // 6. On SLOT_ALREADY_BOOKED error → return friendly error to UI
}

// ─── Edit session (limited fields, not date/time/field) ─────────
export async function editGroupSession(sessionId: string, data: {
  title?: string; description?: string; maxParticipants?: number;
  pricePerPersonEur?: number; skillLevelMin?: number; skillLevelMax?: number;
}) {
  // 1. Auth: must be organizer
  // 2. Verify: not cancelled or completed
  // 3. Update allowed fields only
}

// ─── Request to join a public session ───────────────────────────
export async function requestToJoinSession(sessionId: string) {
  // 1. Auth check
  // 2. Verify: session is public, not cancelled, not full, user meets skill range
  // 3. Verify: user not already a participant
  // 4. Insert session_participants with status='requested'
}

// ─── Organizer approves join request ────────────────────────────
export async function approveJoinRequest(sessionId: string, userId: string) {
  // 1. Auth: must be organizer
  // 2. Verify: participant status='requested'
  // 3. If full → optionally waitlist, or reject
  // 4. Update status to 'confirmed'
  // 5. Trigger increments current_participants
}

// ─── Organizer declines join request ────────────────────────────
export async function declineJoinRequest(sessionId: string, userId: string) {
  // 1. Auth: must be organizer
  // 2. Update status to 'declined'
}

// ─── Leave session (not organizer) ──────────────────────────────
export async function leaveSession(sessionId: string) {
  // 1. Auth check (cannot be organizer)
  // 2. Remove participant record
  // 3. Trigger decrements count
  // 4. Promote first waitlisted person to confirmed
}

// ─── Invite to private session ──────────────────────────────────
export async function inviteToSession(sessionId: string, data: {
  userIds?: string[]; emails?: string[]; generateLink?: boolean;
}) {
  // 1. Verify organizer
  // 2. Create session_invites records
  // 3. If generateLink → create invite with invite_code
}

// ─── Accept invite (auto-confirms participant) ──────────────────
export async function acceptInvite(inviteCode: string) {
  // 1. Look up invite by code
  // 2. Add user as participant with status='confirmed' (auto-confirm)
  // 3. Mark invite as accepted
}

// ─── Cancel session ─────────────────────────────────────────────
export async function cancelSession(sessionId: string) {
  // 1. Auth: organizer or club admin
  // 2. Set is_cancelled=true, cancelled_reason='manual'
  // 3. If is_confirmed=true and booking_id exists:
  //    → Set booking status='cancelled'
}

// ─── Mark session complete ──────────────────────────────────────
export async function markSessionComplete(sessionId: string) {
  // 1. Verify organizer or club admin
  // 2. Verify is_confirmed=true (can't complete a draft)
  // 3. Set completed_at = now()
  // 4. Increment total_sessions_played in user_sport_rankings for confirmed participants
  // 5. Rating window is now open (no time limit)
}
```

## 9.2 Build Session Pages

### `/sessions` — Browse Public Sessions
- Shows **public** sessions only (draft + confirmed, NOT cancelled/expired)
- Filter: sport, city, date range, skill level range
- Session cards with **status badge** (Draft/Active)
- "Request to Join" button on each card

### `/sessions/[id]` — Session Detail
- **Status banner** at top: Draft (yellow), Active (green), Completed (blue), Cancelled (red), Expired (gray)
  - Use `getSessionStatus()` helper from `lib/db/queries.ts`
- Full session info, organizer card, participant list (with status badges per participant)
- **Actions vary by role and session status:**
  - Any user on public session: "Request to Join"
  - Confirmed participant: "Leave"
  - Organizer on draft: "Confirm Session", "Edit", "Cancel"
  - Organizer on active: "Edit", "Cancel", "Invite Players", "Mark Complete"
  - Organizer: Pending join requests section with "Approve" / "Decline" per request
- After completed: "Rate Players" section (no time limit)

### `/sessions/new` — Create Session Wizard
- Step 1: Pick sport category
- Step 2: Pick field
- Step 3: Pick date + slot — show **all slots** (booked ones greyed out). Available slots show price + session badges. User can only select available slots.
  - The API endpoint (`/api/sessions/slots`) should return ALL slots (not just available)
- Step 4: Session details (title, description, visibility, max participants, price, skill range)
- Step 5: Review — clear message: "This creates a **draft** session. Slot is NOT reserved until confirmed."
- Submit → creates draft session → redirect to `/sessions/[id]`

### `/dashboard/group-sessions` — Club Admin Management (MUST BE FULLY IMPLEMENTED)
- Table of all group sessions across the active club's locations
- Filters: location, sport, date range, status (Draft/Active/Completed/Cancelled/Expired), visibility
- Columns: Title, Field, Location, Date/Time, Organizer, Participants (current/max), Visibility badge, Status badge, Pending requests
- Actions: "View Detail", "Cancel Session"

## 9.3 Session Components

- `components/sessions/session-card.tsx` — renders status badge (Draft/Active/Completed/Cancelled/Expired), participant bar, organizer info
- `components/sessions/participant-list.tsx` — avatars + names + status badges (confirmed/requested/waitlisted/invited)
- `components/sessions/invite-modal.tsx` — search users + generate invite link

---

# PHASE 10: RANKINGS & RATINGS

## 10.1 Rating Server Actions

Create `lib/actions/rating-actions.ts`:

```typescript
'use server';

export async function ratePlayer(data: {
  sessionId: string; ratedUserId: string;
  rating: number; // 1-5 overall
  skillRating?: number; sportsmanshipRating?: number;
  teamworkRating?: number; punctualityRating?: number;
  comment?: string;
}) {
  // 1. Auth check
  // 2. Verify both rater and rated were confirmed participants in the same session
  // 3. Verify session is completed (completed_at IS NOT NULL)
  // 4. Verify not self-rating, not already rated
  // 5. No time limit check — rating is allowed at any point after completion
  // 6. Get sport_category_id from session
  // 7. Insert user_ratings → trigger auto-updates user_sport_rankings
  // 8. Optionally insert user_rating_details per criteria
}

export async function getPlayerRankings(userId: string) {
  // All sport rankings for a user
}

export async function getLeaderboard(sportCategoryId: string, options?: { limit?, offset?, city? }) {
  // Top-rated players for a sport
}

export async function getSessionRatingStatus(sessionId: string, raterId: string) {
  // Who can still be rated, who's already rated
}
```

## 10.2 Build Rating Components

- `components/ratings/rating-stars.tsx` — interactive 1-5 star input + display
- `components/ratings/rate-players-form.tsx` — form listing other session participants, rating inputs per person
- `components/ratings/ranking-card.tsx` — display a user's sport ranking (stars, count, position)
- `components/ratings/ranking-breakdown.tsx` — per-criteria bars (skill, sportsmanship, etc.)
- `components/ratings/leaderboard-table.tsx` — ranked player list with sport filter

## 10.3 Build Rating Pages

- `/my/rankings` — user sees their own rankings per sport, breakdown, position in leaderboard
- `/my/sessions` → past sessions → "Rate Players" button → `RatePlayersForm`
- `/players` — leaderboard page, filter by sport, search by name
- `/players/[id]` — player profile with all rankings, recent sessions, rating breakdown

## 10.4 Verify Triggers Work

Test the full flow:
1. Create a draft group session → confirm it (reserves slot)
2. Have 2+ users request to join → organizer approves
3. Mark session as complete
4. Rate another user (should work at any time after completion — no time limit)
5. Verify `user_sport_rankings` table updated automatically
6. Verify the player profile shows the updated rating
7. Verify rankings are shown from the very first rating

---

# PHASE 11: POLISH & PRODUCTION

## 11.1 Loading States

Add Skeleton components to every page that fetches data:
- `app/(dashboard)/dashboard/loading.tsx`
- `app/(public)/loading.tsx`
- etc.

## 11.2 Empty States

Every list needs an empty state with CTA:
- No locations → "Add your first location"
- No bookings → "No bookings yet"
- No sessions → "No public sessions. Create one!"
- No ratings → "Play a session to start building your ranking!"

## 11.3 Error Handling

- Wrap all server actions in try/catch
- Return `{ success: boolean, error?: string, data?: any }` pattern
- Show toast notifications (success/error) using shadcn `toast`
- Add `error.tsx` error boundary files in route groups

## 11.4 Responsive Design

Priority areas:
1. **Daily Schedule Grid** — single field view on mobile with field dropdown
2. **Dashboard Sidebar** — hamburger menu on mobile
3. **Sport Icon Bar** — horizontal scroll on mobile
4. **Club listing** — stack cards vertically on mobile
5. **Session cards** — full width on mobile

## 11.5 Supabase Realtime (REQUIRED — NOT OPTIONAL)

Add Supabase Realtime to the Daily Schedule Grid. Subscribe to **both** `bookings` and `group_sessions` tables:

```typescript
// In the DailyScheduleGrid client component:
useEffect(() => {
  const supabase = createClient();
  const channel = supabase
    .channel('schedule-updates')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'bookings',
      filter: `field_id=in.(${fieldIds.join(',')})`,
    }, () => refreshSchedule())
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'group_sessions',
      filter: `field_id=in.(${fieldIds.join(',')})`,
    }, () => refreshSchedule())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [fieldIds]);
```

This ensures:
- When User A books a slot, User B sees it turn green in real-time
- When a draft session is created, confirmed, or cancelled, the slot grid updates for all viewers
- When a session is auto-cancelled (deadline expired or slot taken), the grid reflects it

## 11.6 pg_cron Auto-Cancel Setup

Deploy the auto-cancel function and schedule the cron job:

```sql
-- Function (should already be in supabase-schema.sql)
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

-- Schedule via Supabase SQL Editor or migration
SELECT cron.schedule(
  'auto-cancel-expired-sessions',
  '*/15 * * * *',
  $$ SELECT auto_cancel_expired_sessions(); $$
);
```

Verify: create a draft session with a deadline in the past, wait 15 minutes, confirm it's auto-cancelled with `cancelled_reason = 'deadline_expired'`.

## 11.7 Image Uploads

Use Supabase Storage for:
- Club logos
- Location cover images
- Location gallery images
- Field cover images
- User avatars

Create a storage bucket `public-images` in Supabase, set appropriate policies, and create a reusable upload component.

## 11.8 SEO

For public pages, add metadata:

```typescript
// app/(public)/sports/[category]/page.tsx
export async function generateMetadata({ params }) {
  const category = await getSportCategory(params.category);
  return {
    title: `${category.name} Fields & Courts | Sportly`,
    description: `Find and book ${category.name} facilities near you. Compare prices, check availability, and book in seconds.`,
    openGraph: { /* ... */ },
  };
}
```

## 11.9 Deploy to Vercel

```bash
# 1. Push to GitHub
git add . && git commit -m "Sportly initial" && git push

# 2. Connect to Vercel
# Import project from GitHub on vercel.com

# 3. Add environment variables in Vercel project settings:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# DATABASE_URL
# NEXT_PUBLIC_APP_URL (your vercel domain)

# 4. Deploy
```

---

# QUICK REFERENCE: KEY FILE LOCATIONS

| What | Where |
|---|---|
| Supabase browser client | `lib/supabase/client.ts` |
| Supabase server client | `lib/supabase/server.ts` |
| Supabase admin client | `lib/supabase/admin.ts` |
| Drizzle ORM connection | `lib/db/drizzle.ts` |
| Drizzle schema (all tables) | `lib/db/schema.ts` |
| Master SQL schema | `lib/db/supabase-schema.sql` |
| SQL seed script | `lib/db/seed.sql` |
| Reusable query helpers + `getSessionStatus()` | `lib/db/queries.ts` |
| Auth helpers | `lib/auth/helpers.ts` |
| Impersonation logic | `lib/auth/impersonation.ts` |
| Slot generator algorithm (with session attachment) | `lib/booking/slot-generator.ts` |
| Price formatting | `lib/utils/price.ts` |
| Admin server actions | `lib/actions/admin-actions.ts` |
| Location/field server actions | `lib/actions/location-actions.ts`, `lib/actions/field-actions.ts` |
| Booking server actions (`createPublicBooking`, `cancelBooking`) | `lib/actions/booking-actions.ts` |
| Session server actions (11 actions: create, confirm, edit, request, approve, decline, leave, invite, accept, cancel, complete) | `lib/actions/session-actions.ts` |
| Rating server actions | `lib/actions/rating-actions.ts` |
| Schedule server actions | `lib/actions/schedule-actions.ts` |
| Daily Schedule Grid (with Realtime) | `components/booking/daily-schedule-grid.tsx` |
| Slot Cell (with session badge) | `components/booking/slot-cell.tsx` |
| Booking Modal (2-tab: Book Directly + Join Session) | `components/booking/booking-modal.tsx` |
| Session Card (with status badge) | `components/sessions/session-card.tsx` |
| Wizard component | `components/forms/wizard.tsx` |
| Weekly Schedule Editor | `components/forms/weekly-schedule-editor.tsx` |
| Middleware | `middleware.ts` |

---

# CURSOR PROMPTING TIPS

When working phase-by-phase in Cursor:

1. **Always reference both files**: "Follow SPORTLY-BLUEPRINT.md for the full spec and SPORTLY-IMPLEMENTATION-GUIDE.md for implementation steps"

2. **One phase at a time**: Don't skip ahead. Each phase depends on the previous.

3. **Test after each phase**:
   - Phase 2: Can you see tables in Supabase? Does seed data exist? Do triggers fire?
   - Phase 3: Can you sign up, log in, see your profile?
   - Phase 4: Do layouts render? Does impersonation work?
   - Phase 5: Can you CRUD sport categories and clubs?
   - Phase 6: Can you create a location with fields via the wizard?
   - Phase 7: Does the slot grid show? Can you book? Do only confirmed bookings block slots? Does booking modal have 2 tabs?
   - Phase 8: Do public pages load with real data?
   - Phase 9: Can you create a DRAFT session? Does the slot remain available? Can you confirm the session (reserves slot)? Can another user request to join? Can the organizer approve/decline? Does auto-cancel work for expired sessions?
   - Phase 10: Can you rate players after a completed session (no time limit)?
   - Phase 11: Does Realtime work (book on one tab, see update on another)? Does pg_cron cancel expired drafts?

4. **Schema first, always**: If Cursor generates code that doesn't match the DB schema, the schema wins. Adjust the code.

5. **Server Components by default**: Everything in `app/` is a Server Component unless you add `'use client'`. Keep data fetching server-side. Only add `'use client'` for interactive elements (forms, dropdowns, modals, the schedule grid).

6. **Server Actions for mutations**: ALL create/update/delete operations should be server actions (`'use server'`) in `lib/actions/`. Never call Supabase directly from client components for mutations.

7. **Type safety**: Always import types from `lib/db/schema.ts`. Use `InferSelectModel<typeof tableName>` for TypeScript types of DB rows.
