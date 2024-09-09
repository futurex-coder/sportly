import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PlayerProfileClient from './player-profile-client';

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, city, created_at')
    .eq('id', id)
    .single();

  if (!profile) notFound();

  // Sport rankings
  const { data: rankings } = await supabase
    .from('user_sport_rankings')
    .select('id, rating, total_ratings_received, total_sessions_played, sport_category_id, sport_categories(id, name, slug, icon, color_primary)')
    .eq('user_id', id)
    .order('rating', { ascending: false });

  // Per-criteria breakdowns
  const sportIds = (rankings ?? []).map((r) => r.sport_category_id);
  let criteriaBreakdowns: Record<string, { criteriaName: string; avgScore: number; count: number }[]> = {};

  if (sportIds.length > 0) {
    const { data: ratingRows } = await supabase
      .from('user_ratings')
      .select('id, sport_category_id')
      .eq('rated_id', id)
      .in('sport_category_id', sportIds);

    const ratingIds = (ratingRows ?? []).map((r) => r.id);

    if (ratingIds.length > 0) {
      const { data: details } = await supabase
        .from('user_rating_details')
        .select(
          `score, criteria_id,
           rating_criteria(name, sport_category_id),
           user_ratings!inner(sport_category_id)`
        )
        .in('user_rating_id', ratingIds);

      const grouped: Record<string, Record<string, number[]>> = {};
      (details ?? []).forEach((d: any) => {
        const sportId = d.user_ratings?.sport_category_id ?? d.rating_criteria?.sport_category_id;
        const name = d.rating_criteria?.name;
        if (!sportId || !name) return;
        if (!grouped[sportId]) grouped[sportId] = {};
        if (!grouped[sportId][name]) grouped[sportId][name] = [];
        grouped[sportId][name].push(d.score);
      });

      for (const [sportId, criteria] of Object.entries(grouped)) {
        criteriaBreakdowns[sportId] = Object.entries(criteria).map(([name, scores]) => ({
          criteriaName: name,
          avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
          count: scores.length,
        }));
      }
    }
  }

  // Recent sessions (as participant, confirmed)
  const { data: recentParticipations } = await supabase
    .from('session_participants')
    .select(
      `session_id, status,
       group_sessions!inner(id, title, date, start_time, end_time, max_participants, current_participants, completed_at,
         sport_categories(name, icon),
         fields!inner(name, locations!inner(name, city, clubs!inner(name, slug))))`
    )
    .eq('user_id', id)
    .eq('status', 'confirmed')
    .order('joined_at', { ascending: false })
    .limit(10);

  // Recent ratings received (with rater info)
  const { data: recentRatings } = await supabase
    .from('user_ratings')
    .select(
      `id, rating, skill_rating, sportsmanship_rating, comment, created_at,
       profiles!user_ratings_rater_id_fkey(full_name, avatar_url),
       group_sessions(title, date),
       sport_categories(name, icon)`
    )
    .eq('rated_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PlayerProfileClient
        profile={profile}
        rankings={rankings ?? []}
        criteriaBreakdowns={criteriaBreakdowns}
        recentSessions={(recentParticipations ?? []).map((p) => (p as any).group_sessions)}
        recentRatings={recentRatings ?? []}
      />
    </div>
  );
}
