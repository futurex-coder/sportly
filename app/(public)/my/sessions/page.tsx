import { requireAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import MySessionsClient from './my-sessions-client';

interface ParticipationRow {
  id: string;
  status: string;
  session_id: string;
  group_sessions: {
    id: string;
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    organizer_id: string | null;
    visibility: string;
    max_participants: number;
    current_participants: number;
    is_confirmed: boolean | null;
    is_cancelled: boolean | null;
    cancelled_reason: string | null;
    completed_at: string | null;
    confirmation_deadline: string | null;
    fields: { name: string; locations: { name: string; city: string; clubs: { name: string; slug: string } } };
    sport_categories: { name: string; icon: string | null } | null;
  };
}

export default async function MySessionsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  // Single query: all sessions the user participates in (organizer is always a participant)
  const { data: participations } = await supabase
    .from('session_participants')
    .select(
      `id, status, session_id,
       group_sessions!inner(id, title, date, start_time, end_time, organizer_id, visibility, max_participants, current_participants,
         is_confirmed, is_cancelled, cancelled_reason, completed_at, confirmation_deadline,
         fields!inner(name, locations!inner(name, city, clubs!inner(name, slug))),
         sport_categories(name, icon))`
    )
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(100)
    .returns<ParticipationRow[]>();

  // For completed past sessions, check which ones have ALL participants rated
  const completedPastSessionIds = (participations ?? [])
    .filter((p) => {
      const sess = p.group_sessions as any;
      return sess?.date < today && sess?.completed_at;
    })
    .map((p) => (p.group_sessions as any)?.id)
    .filter(Boolean);
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
      participations={participations ?? []}
      fullyRatedSessionIds={Array.from(fullyRatedSessionIds)}
      today={today}
      currentUserId={user.id}
    />
  );
}
