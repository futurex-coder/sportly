import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import SessionListClient from './session-list-client';
import type { SessionCardData } from '@/components/sessions/session-card';

interface SessionRow extends SessionCardData {
  confirmation_deadline: string | null;
}

export default async function SessionsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const { data: sessions } = await supabase
    .from('group_sessions')
    .select(
      `id, title, description, visibility, date, start_time, end_time,
       max_participants, current_participants, price_per_person_eur,
       skill_level_min, skill_level_max,
       is_confirmed, is_cancelled, cancelled_reason, completed_at,
       confirmation_deadline,
       organizer_id, profiles!group_sessions_organizer_id_fkey(full_name, avatar_url),
       sport_categories(id, name, slug, icon, color_primary),
       fields!inner(name, locations!inner(name, city, clubs!inner(name, slug)))`
    )
    .eq('visibility', 'public')
    .eq('is_cancelled', false)
    .gte('date', today)
    .or(`is_confirmed.eq.true,confirmation_deadline.is.null,confirmation_deadline.gt.${now}`)
    .order('date')
    .order('start_time')
    .limit(100)
    .returns<SessionRow[]>();

  const { data: categories } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon')
    .eq('is_active', true)
    .order('sort_order');

  // Collect unique cities
  const cities = Array.from(
    new Set(
      (sessions ?? [])
        .map((s) => (s.fields as any)?.locations?.city)
        .filter(Boolean)
    )
  ).sort();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Group Sessions</h1>
          <p className="text-muted-foreground text-sm">
            Join public sessions and play with others.
          </p>
        </div>
        {user && (
          <Button asChild>
            <Link href="/sessions/new">
              <Plus className="mr-2 size-4" /> Create Session
            </Link>
          </Button>
        )}
      </div>

      <SessionListClient
        sessions={sessions ?? []}
        categories={categories ?? []}
        cities={cities}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
