import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import PlayersClient from './players-client';

export default async function PlayersPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: categories } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon')
    .eq('is_active', true)
    .order('sort_order');

  const defaultCategoryId = categories?.[0]?.id ?? '';

  // Pre-load first page of leaderboard for the default sport
  let initialEntries: any[] = [];
  let initialTotal = 0;

  if (defaultCategoryId) {
    const { data: entries } = await supabase
      .from('user_sport_rankings')
      .select(
        `id, rating, total_ratings_received, total_sessions_played,
         user_id, profiles!inner(id, full_name, avatar_url, city),
         sport_categories(id, name, icon)`
      )
      .eq('sport_category_id', defaultCategoryId)
      .gt('total_ratings_received', 0)
      .order('rating', { ascending: false })
      .range(0, 19);

    initialEntries = (entries ?? []).map((e, i) => ({ ...e, rank: i + 1 }));

    const { count } = await supabase
      .from('user_sport_rankings')
      .select('id', { count: 'exact', head: true })
      .eq('sport_category_id', defaultCategoryId)
      .gt('total_ratings_received', 0);

    initialTotal = count ?? 0;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-muted-foreground text-sm">
          Top-rated players across all sports. Find and connect with other athletes.
        </p>
      </div>

      <PlayersClient
        categories={categories ?? []}
        initialCategoryId={defaultCategoryId}
        initialEntries={initialEntries}
        initialTotal={initialTotal}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
