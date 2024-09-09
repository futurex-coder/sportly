# Sportly

Sports facility booking and group session management platform built with Next.js 15, Supabase, and Tailwind CSS.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Database**: [Supabase](https://supabase.com/) (Postgres + Auth + Realtime)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **UI**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)

## Getting Started

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

## Database Setup

See [docs/SETUP-AND-TESTING-GUIDE.md](docs/SETUP-AND-TESTING-GUIDE.md) for full instructions.

In short:
1. Run `lib/db/supabase-schema.sql` in Supabase SQL Editor
2. Run `lib/db/migrations/001_session_draft_lifecycle.sql`
3. Run `lib/db/seed.sql` for test data
4. Optionally run `lib/db/migrations/002_pg_cron_auto_cancel.sql`

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Documentation

- [Blueprint](docs/SPORTLY-BLUEPRINT.md) — full system specification
- [Implementation Guide](docs/SPORTLY-IMPLEMENTATION-GUIDE.md) — phase-by-phase build guide
- [Setup & Testing Guide](docs/SETUP-AND-TESTING-GUIDE.md) — database setup + E2E test cases
