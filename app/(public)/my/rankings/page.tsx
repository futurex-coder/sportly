import { requireAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { Trophy } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import RankingCard, { type RankingCardData } from '@/components/ratings/ranking-card';

export default async function MyRankingsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  // Per-sport rankings
  const { data: rankings } = await supabase
    .from('user_sport_rankings')
    .select('*, sport_categories(id, name, icon, slug, color_primary)')
    .eq('user_id', user.id)
    .order('rating', { ascending: false });

  if (!rankings || rankings.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No rankings yet"
        description="Play a session to start building your ranking!"
        actionLabel="Browse Sessions"
        actionHref="/sessions"
      />
    );
  }

  // Fetch per-criteria breakdowns
  const sportIds = rankings.map((r) => r.sport_category_id);

  const { data: ratingRows } = await supabase
    .from('user_ratings')
    .select('id, sport_category_id')
    .eq('rated_id', user.id)
    .in('sport_category_id', sportIds);

  const ratingIds = (ratingRows ?? []).map((r) => r.id);
  let criteriaBreakdowns: Record<string, { criteriaName: string; avgScore: number; count: number }[]> = {};

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

  // Leaderboard positions
  const positions: Record<string, { rank: number; total: number }> = {};
  for (const r of rankings) {
    const { count } = await supabase
      .from('user_sport_rankings')
      .select('id', { count: 'exact', head: true })
      .eq('sport_category_id', r.sport_category_id);

    const { count: aboveCount } = await supabase
      .from('user_sport_rankings')
      .select('id', { count: 'exact', head: true })
      .eq('sport_category_id', r.sport_category_id)
      .gt('rating', r.rating);

    positions[r.sport_category_id] = {
      rank: (aboveCount ?? 0) + 1,
      total: count ?? 0,
    };
  }

  // Build card data
  const cards: RankingCardData[] = rankings.map((r) => {
    const sc = r.sport_categories as any;
    return {
      sportCategory: {
        id: sc?.id,
        name: sc?.name ?? 'Sport',
        icon: sc?.icon ?? null,
        slug: sc?.slug,
        color_primary: sc?.color_primary,
      },
      rating: Number(r.rating),
      totalRatingsReceived: r.total_ratings_received ?? 0,
      totalSessionsPlayed: r.total_sessions_played ?? 0,
      position: positions[r.sport_category_id],
      criteriaBreakdown: criteriaBreakdowns[r.sport_category_id],
    };
  });

  return (
    <div className="space-y-6">
      {cards.map((card, i) => (
        <RankingCard key={i} data={card} />
      ))}
    </div>
  );
}
