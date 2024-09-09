'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './types';

// ─── Rate a Player ──────────────────────────────────

export async function ratePlayer(data: {
  sessionId: string;
  ratedUserId: string;
  rating: number;
  skillRating?: number;
  sportsmanshipRating?: number;
  comment?: string;
  criteriaScores?: { criteriaId: string; score: number }[];
}): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    if (data.ratedUserId === user.id) {
      return { success: false, error: 'You cannot rate yourself' };
    }

    if (data.rating < 1 || data.rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, sport_category_id, completed_at, is_cancelled')
      .eq('id', data.sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (!session.completed_at) return { success: false, error: 'Session is not yet completed' };
    if (session.is_cancelled) return { success: false, error: 'Session was cancelled' };

    const { data: raterParticipant } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', data.sessionId)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .single();

    if (!raterParticipant) {
      return { success: false, error: 'You were not a confirmed participant in this session' };
    }

    const { data: ratedParticipant } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', data.sessionId)
      .eq('user_id', data.ratedUserId)
      .eq('status', 'confirmed')
      .single();

    if (!ratedParticipant) {
      return { success: false, error: 'The player was not a confirmed participant in this session' };
    }

    const { data: existing } = await supabase
      .from('user_ratings')
      .select('id')
      .eq('rater_id', user.id)
      .eq('rated_id', data.ratedUserId)
      .eq('session_id', data.sessionId)
      .single();

    if (existing) {
      return { success: false, error: 'You have already rated this player for this session' };
    }

    const { data: ratingRow, error: insertErr } = await supabase
      .from('user_ratings')
      .insert({
        rater_id: user.id,
        rated_id: data.ratedUserId,
        session_id: data.sessionId,
        sport_category_id: session.sport_category_id,
        rating: data.rating,
        skill_rating: data.skillRating ?? null,
        sportsmanship_rating: data.sportsmanshipRating ?? null,
        comment: data.comment?.trim() || null,
      })
      .select('id')
      .single();

    if (insertErr) {
      if (insertErr.message.includes('user_ratings_rater_rated_session_key')) {
        return { success: false, error: 'You have already rated this player for this session' };
      }
      return { success: false, error: insertErr.message };
    }

    if (data.criteriaScores && data.criteriaScores.length > 0 && ratingRow) {
      const detailRows = data.criteriaScores
        .filter((c) => c.score >= 1 && c.score <= 5)
        .map((c) => ({
          user_rating_id: ratingRow.id,
          criteria_id: c.criteriaId,
          score: c.score,
        }));

      if (detailRows.length > 0) {
        await supabase.from('user_rating_details').insert(detailRows);
      }
    }

    revalidatePath(`/sessions/${data.sessionId}`);
    revalidatePath('/my/sessions');
    revalidatePath('/my/rankings');
    revalidatePath(`/players/${data.ratedUserId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to submit rating' };
  }
}

// ─── Get Player Rankings ────────────────────────────

export async function getPlayerRankings(userId: string) {
  const supabase = await createClient();

  const { data: rankings } = await supabase
    .from('user_sport_rankings')
    .select(
      `id, rating, total_ratings_received, total_sessions_played, wins, losses,
       sport_categories(id, name, slug, icon, color_primary)`
    )
    .eq('user_id', userId)
    .order('rating', { ascending: false });

  if (!rankings || rankings.length === 0) {
    return { rankings: [], criteriaBreakdowns: {} };
  }

  const sportCategoryIds = rankings
    .map((r) => (r.sport_categories as any)?.id)
    .filter(Boolean);

  const { data: ratings } = await supabase
    .from('user_ratings')
    .select('id, sport_category_id')
    .eq('rated_id', userId)
    .in('sport_category_id', sportCategoryIds);

  const ratingIds = (ratings ?? []).map((r) => r.id);

  let criteriaBreakdowns: Record<
    string,
    { criteriaName: string; avgScore: number; count: number }[]
  > = {};

  if (ratingIds.length > 0) {
    const { data: details } = await supabase
      .from('user_rating_details')
      .select(
        `score, criteria_id,
         rating_criteria(id, name, sport_category_id),
         user_ratings!inner(sport_category_id)`
      )
      .in('user_rating_id', ratingIds);

    const grouped: Record<string, Record<string, number[]>> = {};
    (details ?? []).forEach((d) => {
      const sportId =
        (d.user_ratings as any)?.sport_category_id ??
        (d.rating_criteria as any)?.sport_category_id;
      if (!sportId) return;
      const name = (d.rating_criteria as any)?.name ?? 'Unknown';
      if (!grouped[sportId]) grouped[sportId] = {};
      if (!grouped[sportId][name]) grouped[sportId][name] = [];
      grouped[sportId][name].push(d.score);
    });

    for (const [sportId, criteria] of Object.entries(grouped)) {
      criteriaBreakdowns[sportId] = Object.entries(criteria).map(
        ([name, scores]) => ({
          criteriaName: name,
          avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
          count: scores.length,
        })
      );
    }
  }

  return { rankings, criteriaBreakdowns };
}

// ─── Get Leaderboard ────────────────────────────────

export async function getLeaderboard(
  sportCategoryId: string,
  options?: { limit?: number; offset?: number; city?: string }
) {
  const supabase = await createClient();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('user_sport_rankings')
    .select(
      `id, rating, total_ratings_received, total_sessions_played,
       user_id, profiles!inner(id, full_name, avatar_url, city),
       sport_categories(id, name, icon)`
    )
    .eq('sport_category_id', sportCategoryId)
    .gt('total_ratings_received', 0)
    .order('rating', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.city) {
    query = query.eq('profiles.city', options.city);
  }

  const { data: entries } = await query;

  const { count: totalCount } = await supabase
    .from('user_sport_rankings')
    .select('id', { count: 'exact', head: true })
    .eq('sport_category_id', sportCategoryId)
    .gt('total_ratings_received', 0);

  return {
    entries: (entries ?? []).map((e, i) => ({
      ...e,
      rank: offset + i + 1,
    })),
    total: totalCount ?? 0,
  };
}

// ─── Get Session Rating Status ──────────────────────

export async function getSessionRatingStatus(
  sessionId: string,
  raterId: string
) {
  const supabase = await createClient();

  const { data: participants } = await supabase
    .from('session_participants')
    .select(
      `user_id,
       profiles!session_participants_user_id_fkey(id, full_name, avatar_url, city)`
    )
    .eq('session_id', sessionId)
    .eq('status', 'confirmed')
    .neq('user_id', raterId);

  const { data: existingRatings } = await supabase
    .from('user_ratings')
    .select('rated_id')
    .eq('rater_id', raterId)
    .eq('session_id', sessionId);

  const ratedUserIds = new Set(
    (existingRatings ?? []).map((r) => r.rated_id)
  );

  const ratable = (participants ?? []).map((p) => ({
    userId: p.user_id,
    profile: p.profiles,
    alreadyRated: ratedUserIds.has(p.user_id),
  }));

  return {
    participants: ratable,
    allRated: ratable.length > 0 && ratable.every((p) => p.alreadyRated),
    ratedCount: ratable.filter((p) => p.alreadyRated).length,
    totalCount: ratable.length,
  };
}

// ─── Get Rating Criteria ────────────────────────────

export async function getRatingCriteria(sportCategoryId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('rating_criteria')
    .select('id, name, description, weight, sort_order, sport_category_id')
    .eq('is_active', true)
    .order('sort_order');

  if (sportCategoryId) {
    query = query.or(
      `sport_category_id.is.null,sport_category_id.eq.${sportCategoryId}`
    );
  } else {
    query = query.is('sport_category_id', null);
  }

  const { data } = await query;
  return data ?? [];
}

// ─── Get Ratings Received by a User ─────────────────

export async function getRatingsReceived(
  userId: string,
  options?: { sportCategoryId?: string; limit?: number; offset?: number }
) {
  const supabase = await createClient();
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('user_ratings')
    .select(
      `id, rating, skill_rating, sportsmanship_rating, comment, created_at,
       rater_id, profiles!user_ratings_rater_id_fkey(full_name, avatar_url),
       session_id, group_sessions(title, date),
       sport_categories(id, name, icon),
       user_rating_details(score, rating_criteria(name))`
    )
    .eq('rated_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.sportCategoryId) {
    query = query.eq('sport_category_id', options.sportCategoryId);
  }

  const { data } = await query;
  return data ?? [];
}
