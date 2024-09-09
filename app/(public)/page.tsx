import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  CalendarDays,
  Users,
  Trophy,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import HeroSearch from './hero-search';

export default async function LandingPage() {
  const supabase = await createClient();

  // ── Parallel data fetches ──
  const [
    { count: playerCount },
    { count: bookingCount },
    { data: categories },
    { data: newClubs },
    { data: recentPlayers },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('sport_categories')
      .select('id, name, slug, icon, color_primary, color_accent')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('clubs')
      .select('id, name, slug, city, logo_url, description')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, city, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  // Field counts per category
  let categoryCounts: Record<string, number> = {};
  if (categories && categories.length > 0) {
    const { data: fieldCats } = await supabase
      .from('fields')
      .select('sport_category_id')
      .eq('is_active', true);
    (fieldCats ?? []).forEach((f) => {
      categoryCounts[f.sport_category_id] =
        (categoryCounts[f.sport_category_id] || 0) + 1;
    });
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:pb-24 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Book. Play. Compete.
            </h1>
            <p className="mt-4 text-lg text-emerald-100 sm:text-xl">
              Find sports fields near you, book in seconds, create group sessions,
              and track your player rankings.
            </p>
          </div>

          {/* Search bar */}
          <div className="mx-auto mt-10 max-w-2xl">
            <HeroSearch categories={categories ?? []} />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="-mt-8 relative z-10 mx-auto max-w-4xl px-4">
        <div className="grid grid-cols-3 gap-4 rounded-2xl border bg-white p-6 shadow-lg dark:bg-zinc-900">
          <StatCard
            icon={<Users className="size-5 text-emerald-600" />}
            value={playerCount ?? 0}
            label="Players"
          />
          <StatCard
            icon={<CalendarDays className="size-5 text-emerald-600" />}
            value={bookingCount ?? 0}
            label="Reservations"
          />
          <StatCard
            icon={<Trophy className="size-5 text-emerald-600" />}
            value={categories?.length ?? 0}
            label="Sports"
          />
        </div>
      </section>

      {/* ── Sport Categories Grid ── */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Explore by Sport</h2>
            <p className="text-muted-foreground text-sm">
              Browse fields and sessions for your favorite sport.
            </p>
          </div>
        </div>
        {/* Horizontal scroll on mobile, grid on larger screens */}
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 md:grid-cols-4 lg:grid-cols-5">
          {(categories ?? []).map((cat) => (
            <Link
              key={cat.id}
              href={`/sports/${cat.slug}/clubs`}
              className="group relative flex w-28 shrink-0 flex-col items-center rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-auto sm:p-5"
              style={
                {
                  '--sport-color': cat.color_primary ?? '#16a34a',
                } as React.CSSProperties
              }
            >
              <span className="text-3xl sm:text-4xl">{cat.icon}</span>
              <span className="mt-2 text-center text-xs font-semibold sm:text-sm">{cat.name}</span>
              <span className="text-muted-foreground text-[10px] sm:text-xs">
                {categoryCounts[cat.id] ?? 0} field
                {(categoryCounts[cat.id] ?? 0) !== 1 ? 's' : ''}
              </span>
              <div
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl opacity-0 transition-opacity group-hover:opacity-100"
                style={{ backgroundColor: cat.color_primary ?? '#16a34a' }}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ── New Clubs Carousel ── */}
      {newClubs && newClubs.length > 0 && (
        <section className="bg-muted/30 py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">New Clubs</h2>
                <p className="text-muted-foreground text-sm">
                  Recently joined clubs looking for players.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sports/football/clubs">
                  View all <ChevronRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {newClubs.map((club) => (
                <Link
                  key={club.id}
                  href={`/clubs/${club.slug}`}
                  className="group w-64 shrink-0 rounded-xl border bg-white p-4 transition-shadow hover:shadow-md dark:bg-zinc-900"
                >
                  <div className="bg-muted mb-3 flex h-32 items-center justify-center rounded-lg">
                    {club.logo_url ? (
                      <img
                        src={club.logo_url}
                        alt={club.name}
                        className="size-16 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground text-4xl font-bold">
                        {club.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold group-hover:text-emerald-600">
                    {club.name}
                  </h3>
                  {club.city && (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <MapPin className="size-3" /> {club.city}
                    </p>
                  )}
                  {club.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {club.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Recently Registered Players ── */}
      {recentPlayers && recentPlayers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">New Players</h2>
            <p className="text-muted-foreground text-sm">
              Recently joined the community.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {recentPlayers.map((p) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex flex-col items-center rounded-lg border p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
              >
                <Avatar className="mb-2 size-12">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(p.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-center text-sm font-medium">
                  {p.full_name ?? 'Player'}
                </span>
                {p.city && (
                  <span className="text-muted-foreground text-xs">{p.city}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="bg-emerald-600 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to play?</h2>
          <p className="mt-2 text-emerald-100">
            Join thousands of players who book and play every day.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/auth/register">Sign Up Free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-emerald-300 text-white hover:bg-emerald-700"
              asChild
            >
              <Link href="/sports/football/clubs">Browse Fields</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-2xl font-bold tabular-nums sm:text-3xl">
        {value.toLocaleString()}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
