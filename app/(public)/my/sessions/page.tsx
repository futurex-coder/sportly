import { requireAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import MySessionsClient from './my-sessions-client';

export default async function MySessionsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  // Sessions I organised
  const { data: organized } = await supabase
    .from('group_sessions')
    .select(
      `id, title, date, start_time, end_time, visibility, max_participants, current_participants,
       is_confirmed, is_cancelled, cancelled_reason, completed_at,
       fields!inner(name, locations!inner(name, city, clubs!inner(name, slug))),
       sport_categories(name, icon)`
    )
    .eq('organizer_id', user.id)
    .order('date', { ascending: false })
    .limit(50);

  // Sessions I'm participating in
  const { data: participations } = await supabase
    .from('session_participants')
    .select(
      `id, status, session_id,
       group_sessions!inner(id, title, date, start_time, end_time, organizer_id, visibility, max_participants, current_participants,
         is_confirmed, is_cancelled, cancelled_reason, completed_at,
         fields!inner(name, locations!inner(name, city, clubs!inner(name, slug))),
         sport_categories(name, icon))`
    )
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(50);

  // For completed past sessions, check which ones have ALL participants rated
  const completedPastSessionIds = [
    ...(organized ?? []).filter((s) => s.date < today && s.completed_at).map((s) => s.id),
    ...(participations ?? [])
      .filter((p) => {
        const sess = p.group_sessions as any;
        return sess?.date < today && sess?.completed_at;
      })
      .map((p) => (p.group_sessions as any)?.id)
      .filter(Boolean),
  ];
  const uniqueCompletedIds = [...new Set(completedPastSessionIds)];

  let fullyRatedSessionIds = new Set<string>();
  if (uniqueCompletedIds.length > 0) {
    for (const sid of uniqueCompletedIds) {
      // Count confirmed participants (excluding self)
      const { count: othersCount } = await supabase
        .from('session_participants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sid)
        .eq('status', 'confirmed')
        .neq('user_id', user.id);

      // Count how many I've rated in this session
      const { count: ratedCount } = await supabase
        .from('user_ratings')
        .select('id', { count: 'exact', head: true })
        .eq('rater_id', user.id)
        .eq('session_id', sid);

      if ((othersCount ?? 0) > 0 && (ratedCount ?? 0) >= (othersCount ?? 0)) {
        fullyRatedSessionIds.add(sid);
      }
    }
  }

  return (
    <MySessionsClient
      organized={organized ?? []}
      participations={participations ?? []}
      fullyRatedSessionIds={Array.from(fullyRatedSessionIds)}
      today={today}
      currentUserId={user.id}
    />
  );
}
