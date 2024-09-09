import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CalendarDays,
  Users,
  MapPin,
  ChevronRight,
  Layers,
} from 'lucide-react';
import HeroSearch from '../../hero-search';

export default async function SportLandingPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const supabase = await createClient();

  // Fetch the sport category
  const { data: sport } = await supabase
    .from('sport_categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!sport) notFound();

  // Fetch all categories for the search bar
  const { data: allCategories } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon, color_primary')
    .eq('is_active', true)
    .order('sort_order');

  // Parallel data fetches filtered to this sport
  const [
    { count: playerCount },
    { count: bookingCount },
    { count: fieldCount },
    { data: clubs },
  ] = await Promise.all([
    // Players who have bookings/sessions for fields of this sport
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('bookings')
      .select('id, fields!inner(sport_category_id)', { count: 'exact', head: true })
      .eq('fields.sport_category_id', sport.id),
    supabase
      .from('fields')
      .select('id', { count: 'exact', head: true })
      .eq('sport_category_id', sport.id)
      .eq('is_active', true),
    // Clubs that have fields for this sport
    supabase
      .from('fields')
      .select('location_id, locations!inner(club_id, clubs!inner(id, name, slug, city, logo_url, description))')
      .eq('sport_category_id', sport.id)
      .eq('is_active', true)
      .limit(50),
  ]);

  // Deduplicate clubs from fields
  const clubMap = new Map<
    string,
    { id: string; name: string; slug: string; city: string | null; logo_url: string | null; description: string | null }
  >();
  (clubs ?? []).forEach((f) => {
    const loc = f.locations as any;
    const club = loc?.clubs;
    if (club && !clubMap.has(club.id)) {
      clubMap.set(club.id, club);
    }
  });
  const uniqueClubs = Array.from(clubMap.values()).slice(0, 8);

  const primary = sport.color_primary ?? '#16a34a';
  const accent = sport.color_accent ?? '#22c55e';

  return (
    <div>
      {/* ── Themed Hero ── */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:pb-24 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-2 text-6xl">{sport.icon}</span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Sportly <span className="opacity-90">{sport.name}</span>
            </h1>
            <p className="mt-3 text-lg opacity-80">
              Find {sport.name.toLowerCase()} fields, book instantly, and play with others.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <HeroSearch categories={allCategories ?? []} />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative z-10 -mt-8 mx-auto max-w-4xl px-4">
        <div className="grid grid-cols-3 gap-4 rounded-2xl border bg-white p-6 shadow-lg dark:bg-zinc-900">
          <StatCard
            icon={<Layers className="size-5" style={{ color: primary }} />}
            value={fieldCount ?? 0}
            label="Fields"
          />
          <StatCard
            icon={<CalendarDays className="size-5" style={{ color: primary }} />}
            value={bookingCount ?? 0}
            label="Bookings"
          />
          <StatCard
            icon={<Users className="size-5" style={{ color: primary }} />}
            value={playerCount ?? 0}
            label="Players"
          />
        </div>
      </section>

      {/* ── Clubs ── */}
      {uniqueClubs.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {sport.icon} {sport.name} Clubs
              </h2>
              <p className="text-muted-foreground text-sm">
                Clubs with {sport.name.toLowerCase()} fields ready to book.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/sports/${slug}/clubs`}>
                View All Clubs <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {uniqueClubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.slug}`}
                className="group rounded-xl border bg-white p-4 transition-shadow hover:shadow-md dark:bg-zinc-900"
              >
                <div className="bg-muted mb-3 flex h-28 items-center justify-center rounded-lg">
                  {club.logo_url ? (
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      className="size-14 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-3xl font-bold"
                      style={{ color: primary }}
                    >
                      {club.name.charAt(0)}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold group-hover:underline">
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
        </section>
      )}

      {/* ── Empty state ── */}
      {uniqueClubs.length === 0 && (
        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <span className="text-6xl">{sport.icon}</span>
          <h2 className="mt-4 text-xl font-bold">
            No {sport.name} clubs yet
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Be the first to register a {sport.name.toLowerCase()} club on Sportly.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/auth/register">Create Your Club</Link>
          </Button>
        </section>
      )}

      {/* ── CTA ── */}
      <section
        className="py-16 text-white"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
        }}
      >
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">
            Ready to play {sport.name.toLowerCase()}?
          </h2>
          <p className="mt-2 opacity-80">
            Browse available fields and book your next game.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link href={`/sports/${slug}/clubs`}>Browse Clubs</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/40 text-white hover:bg-white/10"
              asChild
            >
              <Link href="/auth/register">Sign Up Free</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

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
