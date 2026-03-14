import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import { notFound } from 'next/navigation';
import { expireSessionIfNeeded } from '@/lib/actions/session-actions';
import SessionDetailClient from './session-detail-client';

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: session } = await supabase
    .from('group_sessions')
    .select(
      `id, title, description, visibility, date, start_time, end_time,
       max_participants, current_participants, price_per_person_eur,
       skill_level_min, skill_level_max, is_cancelled, completed_at,
       is_confirmed, confirmation_deadline, cancelled_reason,
       organizer_id, booking_id, sport_category_id,
       profiles!group_sessions_organizer_id_fkey(id, full_name, avatar_url, city),
       sport_categories(id, name, slug, icon, color_primary),
       fields!inner(id, name, slug, locations!inner(id, name, city, address, clubs!inner(id, name, slug)))`
    )
    .eq('id', id)
    .single();

  if (!session) notFound();

  await expireSessionIfNeeded({
    id: session.id,
    is_cancelled: session.is_cancelled ?? false,
    is_confirmed: session.is_confirmed ?? false,
    confirmation_deadline: session.confirmation_deadline,
  });

  // Fetch participants with their profiles
  const { data: participants } = await supabase
    .from('session_participants')
    .select(
      `id, user_id, status, joined_at,
       profiles!session_participants_user_id_fkey(full_name, avatar_url, city)`
    )
    .eq('session_id', id)
    .order('joined_at');

  // Fetch pending invites (organizer only)
  let invites: any[] = [];
  if (user && session.organizer_id === user.id) {
    const { data } = await supabase
      .from('session_invites')
      .select('id, invited_user_id, invited_email, invite_code, status, expires_at')
      .eq('session_id', id)
      .order('created_at', { ascending: false });
    invites = data ?? [];
  }

  // Check if current user is a participant
  const currentParticipant = user
    ? (participants ?? []).find((p) => p.user_id === user.id)
    : null;

  // Get user's sport ranking for skill check display
  let userRating: number | null = null;
  if (user && session.sport_categories) {
    const { data: ranking } = await supabase
      .from('user_sport_rankings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('sport_category_id', (session.sport_categories as any).id)
      .single();
    userRating = ranking ? Number(ranking.rating) : null;
  }

  // Rating data for completed sessions where user is a participant
  let ratingStatus: any = null;
  let ratingCriteria: any[] = [];

  if (user && session.completed_at && currentParticipant?.status === 'confirmed') {
    // Get who can still be rated
    const confirmedOthers = (participants ?? []).filter(
      (p) => p.status === 'confirmed' && p.user_id !== user.id
    );

    const { data: existingRatings } = await supabase
      .from('user_ratings')
      .select('rated_id')
      .eq('rater_id', user.id)
      .eq('session_id', id);

    const ratedIds = new Set((existingRatings ?? []).map((r) => r.rated_id));

    ratingStatus = {
      participants: confirmedOthers.map((p) => ({
        userId: p.user_id,
        profile: p.profiles,
        alreadyRated: ratedIds.has(p.user_id),
      })),
      allRated: confirmedOthers.length > 0 && confirmedOthers.every((p) => ratedIds.has(p.user_id)),
      ratedCount: confirmedOthers.filter((p) => ratedIds.has(p.user_id)).length,
      totalCount: confirmedOthers.length,
    };

    // Fetch criteria
    let criteriaQuery = supabase
      .from('rating_criteria')
      .select('id, name, description')
      .eq('is_active', true)
      .order('sort_order');

    if (session.sport_category_id) {
      criteriaQuery = criteriaQuery.or(
        `sport_category_id.is.null,sport_category_id.eq.${session.sport_category_id}`
      );
    } else {
      criteriaQuery = criteriaQuery.is('sport_category_id', null);
    }

    const { data: criteria } = await criteriaQuery;
    ratingCriteria = criteria ?? [];
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SessionDetailClient
        session={session as any}
        participants={participants ?? []}
        invites={invites}
        currentUserId={user?.id ?? null}
        currentParticipant={currentParticipant ?? null}
        userRating={userRating}
        ratingStatus={ratingStatus}
        ratingCriteria={ratingCriteria}
      />
    </div>
  );
}
