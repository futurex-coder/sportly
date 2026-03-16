'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { getReadClient } from '@/lib/supabase/admin';
import { getFieldBookingInfo } from '@/lib/booking/slot-generator';
import { insertBookingSafe } from './booking-actions';
import { computeConfirmationDeadline } from '@/lib/db/queries';
import type { ActionResult } from './types';

function generateInviteCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function revalidateSessionPaths(sessionId: string) {
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath('/sessions');
  revalidatePath('/my/sessions');
  revalidatePath('/dashboard/group-sessions');
}

// ─── Lazy-write expiry: cancel expired drafts on read ──

export async function expireSessionIfNeeded(session: {
  id: string;
  is_cancelled: boolean;
  is_confirmed: boolean;
  confirmation_deadline: string | null;
}): Promise<boolean> {
  if (
    !session.is_cancelled &&
    !session.is_confirmed &&
    session.confirmation_deadline &&
    new Date(session.confirmation_deadline) < new Date()
  ) {
    const supabase = await createClient();
    await supabase
      .from('group_sessions')
      .update({
        is_cancelled: true,
        cancelled_reason: 'deadline_expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);
    return true;
  }
  return false;
}

// ─── Create Group Session (DRAFT — no booking) ──────

export async function createGroupSession(data: {
  fieldId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  visibility: 'public' | 'private';
  maxParticipants: number;
  pricePerPersonEur?: number;
  pricePerPersonLocal?: number;
  skillLevelMin?: number;
  skillLevelMax?: number;
}): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: field } = await supabase
      .from('fields')
      .select('sport_category_id')
      .eq('id', data.fieldId)
      .single();
    if (!field) return { success: false, error: 'Field not found' };

    // Reject if a non-cancelled booking already occupies this slot
    const readDb = await getReadClient();
    const { data: overlapping } = await readDb
      .from('bookings')
      .select('id')
      .eq('field_id', data.fieldId)
      .eq('date', data.date)
      .lt('start_time', data.endTime)
      .gt('end_time', data.startTime)
      .neq('status', 'cancelled')
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      return { success: false, error: 'SLOT_ALREADY_BOOKED' };
    }

    const deadline = computeConfirmationDeadline(data.date, data.startTime);

    const { data: session, error: sessionErr } = await supabase
      .from('group_sessions')
      .insert({
        field_id: data.fieldId,
        booking_id: null,
        organizer_id: user.id,
        sport_category_id: field.sport_category_id,
        title: data.title,
        description: data.description ?? null,
        visibility: data.visibility,
        date: data.date,
        start_time: data.startTime,
        end_time: data.endTime,
        max_participants: data.maxParticipants,
        current_participants: 0,
        price_per_person_eur: data.pricePerPersonEur ?? 0,
        price_per_person_local: data.pricePerPersonLocal ?? 0,
        skill_level_min: data.skillLevelMin ?? 0,
        skill_level_max: data.skillLevelMax ?? 5,
        is_confirmed: false,
        confirmation_deadline: deadline.toISOString(),
        is_cancelled: false,
      })
      .select('id')
      .single();

    if (sessionErr) return { success: false, error: sessionErr.message };

    await supabase.from('session_participants').insert({
      session_id: session.id,
      user_id: user.id,
      status: 'confirmed',
    });

    revalidateSessionPaths(session.id);
    return { success: true, data: { sessionId: session.id } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create session' };
  }
}

// ─── Confirm Session (reserves the slot atomically) ──

export async function confirmGroupSession(
  sessionId: string
): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select(
        'id, organizer_id, field_id, date, start_time, end_time, ' +
        'is_confirmed, is_cancelled, confirmation_deadline, price_per_person_eur, title'
      )
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Only the organizer can confirm' };
    }
    if (session.is_confirmed) return { success: false, error: 'Session is already confirmed' };
    if (session.is_cancelled) return { success: false, error: 'Session is cancelled' };

    const wasExpired = await expireSessionIfNeeded({
      id: session.id,
      is_cancelled: session.is_cancelled ?? false,
      is_confirmed: session.is_confirmed ?? false,
      confirmation_deadline: session.confirmation_deadline,
    });
    if (wasExpired) {
      return { success: false, error: 'Session deadline has passed — it has been expired.' };
    }

    const info = await getFieldBookingInfo(session.field_id);
    const priceEur = info?.pricePerSlotEur ?? 0;
    const priceLocal = info?.pricePerSlotLocal ?? 0;

    const bookingResult = await insertBookingSafe({
      fieldId: session.field_id,
      userId: user.id,
      date: session.date,
      startTime: session.start_time,
      endTime: session.end_time,
      priceEur,
      priceLocal,
      sessionId: session.id,
      bookedBy: user.id,
      notes: `Group session: ${session.title}`,
    });

    if (bookingResult.error) {
      if (bookingResult.error === 'This slot is already booked.') {
        return { success: false, error: 'The slot has already been booked by someone else. Your session cannot be confirmed.' };
      }
      return { success: false, error: bookingResult.error };
    }

    const { error: updateErr } = await supabase
      .from('group_sessions')
      .update({
        is_confirmed: true,
        booking_id: bookingResult.bookingId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateErr) return { success: false, error: updateErr.message };

    revalidateSessionPaths(sessionId);
    revalidatePath('/my/bookings');
    return { success: true, data: { bookingId: bookingResult.bookingId! } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to confirm session' };
  }
}

// ─── Edit Session (limited fields) ──────────────────

export async function editGroupSession(
  sessionId: string,
  data: {
    title?: string;
    description?: string;
    maxParticipants?: number;
    pricePerPersonEur?: number;
    pricePerPersonLocal?: number;
    skillLevelMin?: number;
    skillLevelMax?: number;
  }
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('organizer_id, is_cancelled, completed_at')
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Only the organizer can edit' };
    }
    if (session.is_cancelled) return { success: false, error: 'Cannot edit a cancelled session' };
    if (session.completed_at) return { success: false, error: 'Cannot edit a completed session' };

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.maxParticipants !== undefined) updatePayload.max_participants = data.maxParticipants;
    if (data.pricePerPersonEur !== undefined) updatePayload.price_per_person_eur = data.pricePerPersonEur;
    if (data.pricePerPersonLocal !== undefined) updatePayload.price_per_person_local = data.pricePerPersonLocal;
    if (data.skillLevelMin !== undefined) updatePayload.skill_level_min = data.skillLevelMin;
    if (data.skillLevelMax !== undefined) updatePayload.skill_level_max = data.skillLevelMax;

    const { error } = await supabase
      .from('group_sessions')
      .update(updatePayload)
      .eq('id', sessionId);

    if (error) return { success: false, error: error.message };

    revalidateSessionPaths(sessionId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to edit session' };
  }
}

// ─── Request to Join (public sessions) ──────────────

export async function requestToJoinSession(
  sessionId: string
): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select(
        'id, visibility, max_participants, current_participants, ' +
        'is_cancelled, is_confirmed, confirmation_deadline, skill_level_min, skill_level_max, sport_category_id'
      )
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.is_cancelled) return { success: false, error: 'Session is cancelled' };

    const wasExpired = await expireSessionIfNeeded({
      id: session.id,
      is_cancelled: session.is_cancelled ?? false,
      is_confirmed: session.is_confirmed ?? false,
      confirmation_deadline: session.confirmation_deadline,
    });
    if (wasExpired) {
      return { success: false, error: 'Session deadline has passed — it has been expired.' };
    }

    if (session.visibility !== 'public') {
      return { success: false, error: 'This is a private session. You can only join via invite.' };
    }
    if (session.current_participants >= session.max_participants) {
      return { success: false, error: 'Session is full' };
    }

    const { data: existing } = await supabase
      .from('session_participants')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      if (existing.status === 'declined') {
        return { success: false, error: 'Your previous request was declined' };
      }
      return { success: false, error: 'You are already in this session' };
    }

    const { data: ranking } = await supabase
      .from('user_sport_rankings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('sport_category_id', session.sport_category_id)
      .single();

    const userRating = ranking ? Number(ranking.rating) : 3.0;
    const minSkill = Number(session.skill_level_min ?? 0);
    const maxSkill = Number(session.skill_level_max ?? 5);

    if (userRating < minSkill || userRating > maxSkill) {
      return {
        success: false,
        error: `Skill level ${userRating.toFixed(1)} is outside the required range (${minSkill}–${maxSkill}).`,
      };
    }

    const { error } = await supabase.from('session_participants').insert({
      session_id: sessionId,
      user_id: user.id,
      status: 'requested',
    });

    if (error) return { success: false, error: error.message };

    revalidateSessionPaths(sessionId);
    return { success: true, data: { status: 'requested' } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to request to join' };
  }
}

/** @deprecated Use requestToJoinSession — will be removed in Phase 12 */
export const joinSession = requestToJoinSession;

// ─── Approve Join Request ───────────────────────────

export async function approveJoinRequest(
  sessionId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('organizer_id, max_participants, current_participants, is_cancelled')
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Only the organizer can approve requests' };
    }
    if (session.is_cancelled) return { success: false, error: 'Session is cancelled' };

    const { data: participant } = await supabase
      .from('session_participants')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!participant) return { success: false, error: 'Participant not found' };
    if (participant.status !== 'requested') {
      return { success: false, error: `Cannot approve a participant with status "${participant.status}"` };
    }

    const isFull = session.current_participants >= session.max_participants;
    const newStatus = isFull ? 'waitlisted' : 'confirmed';

    const { error } = await supabase
      .from('session_participants')
      .update({ status: newStatus })
      .eq('id', participant.id);

    if (error) return { success: false, error: error.message };

    revalidateSessionPaths(sessionId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to approve request' };
  }
}

// ─── Decline Join Request ───────────────────────────

export async function declineJoinRequest(
  sessionId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('organizer_id')
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Only the organizer can decline requests' };
    }

    const { data: participant } = await supabase
      .from('session_participants')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!participant) return { success: false, error: 'Participant not found' };
    if (participant.status !== 'requested') {
      return { success: false, error: `Cannot decline a participant with status "${participant.status}"` };
    }

    const { error } = await supabase
      .from('session_participants')
      .update({ status: 'declined' })
      .eq('id', participant.id);

    if (error) return { success: false, error: error.message };

    revalidateSessionPaths(sessionId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to decline request' };
  }
}

// ─── Leave Session ──────────────────────────────────

export async function leaveSession(sessionId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('organizer_id')
      .eq('id', sessionId)
      .single();

    if (session?.organizer_id === user.id) {
      return { success: false, error: 'Organizers cannot leave. Cancel the session instead.' };
    }

    const { error: delErr } = await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    if (delErr) return { success: false, error: delErr.message };

    const { data: waitlisted } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('status', 'waitlisted')
      .order('joined_at')
      .limit(1)
      .single();

    if (waitlisted) {
      await supabase
        .from('session_participants')
        .update({ status: 'confirmed' })
        .eq('id', waitlisted.id);
    }

    revalidateSessionPaths(sessionId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to leave session' };
  }
}

// ─── Invite to Session ──────────────────────────────

export async function inviteToSession(
  sessionId: string,
  data: {
    userIds?: string[];
    emails?: string[];
    generateLink?: boolean;
  }
): Promise<ActionResult<{ inviteCode: string | null }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('organizer_id, is_cancelled')
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Only the organizer can send invites' };
    }
    if (session.is_cancelled) return { success: false, error: 'Session is cancelled' };

    let inviteCode: string | null = null;

    if (data.userIds && data.userIds.length > 0) {
      const inviteRows = data.userIds.map((uid) => ({
        session_id: sessionId,
        invited_user_id: uid,
        status: 'pending',
      }));
      await supabase.from('session_invites').insert(inviteRows);

      const participantRows = data.userIds.map((uid) => ({
        session_id: sessionId,
        user_id: uid,
        status: 'invited' as const,
        invited_by: user.id,
      }));
      for (const row of participantRows) {
        await supabase.from('session_participants').upsert(row, {
          onConflict: 'session_id,user_id',
          ignoreDuplicates: true,
        });
      }
    }

    if (data.emails && data.emails.length > 0) {
      const emailRows = data.emails.map((email) => ({
        session_id: sessionId,
        invited_email: email,
        status: 'pending',
      }));
      await supabase.from('session_invites').insert(emailRows);
    }

    if (data.generateLink) {
      inviteCode = generateInviteCode();
      await supabase.from('session_invites').insert({
        session_id: sessionId,
        invite_code: inviteCode,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    revalidateSessionPaths(sessionId);
    return { success: true, data: { inviteCode } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to send invites' };
  }
}

// ─── Accept Invite (auto-confirms) ──────────────────

export async function acceptInvite(
  inviteCode: string
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: invite } = await supabase
      .from('session_invites')
      .select('id, session_id, status, expires_at')
      .eq('invite_code', inviteCode)
      .single();

    if (!invite) return { success: false, error: 'Invalid invite code' };
    if (invite.status !== 'pending') return { success: false, error: 'Invite already used' };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { success: false, error: 'Invite has expired' };
    }

    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, max_participants, current_participants, is_cancelled')
      .eq('id', invite.session_id)
      .single();

    if (!session || session.is_cancelled) {
      return { success: false, error: 'Session is no longer available' };
    }

    const isFull = session.current_participants >= session.max_participants;

    const { error: joinErr } = await supabase.from('session_participants').upsert(
      {
        session_id: invite.session_id,
        user_id: user.id,
        status: isFull ? 'waitlisted' : 'confirmed',
      },
      { onConflict: 'session_id,user_id' }
    );

    if (joinErr) return { success: false, error: joinErr.message };

    await supabase
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    revalidateSessionPaths(invite.session_id);
    return { success: true, data: { sessionId: invite.session_id } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to accept invite' };
  }
}

// ─── Accept Direct Invite (user-to-user) ────────────

export async function acceptDirectInvite(
  sessionId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: participant } = await supabase
      .from('session_participants')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!participant) return { success: false, error: 'You are not invited to this session' };
    if (participant.status !== 'invited') {
      return { success: false, error: `Cannot accept — your status is "${participant.status}"` };
    }

    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, max_participants, current_participants, is_cancelled')
      .eq('id', sessionId)
      .single();

    if (!session || session.is_cancelled) {
      return { success: false, error: 'Session is no longer available' };
    }

    const isFull = session.current_participants >= session.max_participants;

    const { error } = await supabase
      .from('session_participants')
      .update({ status: isFull ? 'waitlisted' : 'confirmed' })
      .eq('id', participant.id);

    if (error) return { success: false, error: error.message };

    await supabase
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('session_id', sessionId)
      .eq('invited_user_id', user.id)
      .eq('status', 'pending');

    revalidateSessionPaths(sessionId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to accept invite' };
  }
}

// ─── Decline Direct Invite ──────────────────────────

export async function declineDirectInvite(
  sessionId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: participant } = await supabase
      .from('session_participants')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!participant) return { success: false, error: 'You are not invited to this session' };
    if (participant.status !== 'invited') {
      return { success: false, error: `Cannot decline — your status is "${participant.status}"` };
    }

    const { error } = await supabase
      .from('session_participants')
      .update({ status: 'declined' })
      .eq('id', participant.id);

    if (error) return { success: false, error: error.message };

    await supabase
      .from('session_invites')
      .update({ status: 'declined' })
      .eq('session_id', sessionId)
      .eq('invited_user_id', user.id)
      .eq('status', 'pending');

    revalidateSessionPaths(sessionId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to decline invite' };
  }
}

// ─── Cancel Session ─────────────────────────────────

export async function cancelSession(sessionId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('organizer_id, booking_id, is_cancelled')
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.is_cancelled) return { success: false, error: 'Session is already cancelled' };
    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Only the organizer can cancel' };
    }

    const { error } = await supabase
      .from('group_sessions')
      .update({
        is_cancelled: true,
        cancelled_reason: 'manual',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) return { success: false, error: error.message };

    if (session.booking_id) {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', session.booking_id);
    }

    revalidateSessionPaths(sessionId);
    revalidatePath('/my/bookings');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to cancel session' };
  }
}

// ─── Mark Session Complete ──────────────────────────

export async function markSessionComplete(sessionId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: session } = await supabase
      .from('group_sessions')
      .select('organizer_id, sport_category_id, is_confirmed, is_cancelled, completed_at, booking_id')
      .eq('id', sessionId)
      .single();

    if (!session) return { success: false, error: 'Session not found' };
    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Only the organizer can mark as complete' };
    }
    if (session.is_cancelled) return { success: false, error: 'Session is cancelled' };
    if (session.completed_at) return { success: false, error: 'Session is already completed' };
    if (!session.is_confirmed) return { success: false, error: 'Cannot complete a draft session — confirm it first' };

    const { error } = await supabase
      .from('group_sessions')
      .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) return { success: false, error: error.message };

    const { data: participants } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('status', 'confirmed');

    const participantIds = (participants ?? []).map((p) => p.user_id);

    for (const uid of participantIds) {
      const { data: existing } = await supabase
        .from('user_sport_rankings')
        .select('id, total_sessions_played')
        .eq('user_id', uid)
        .eq('sport_category_id', session.sport_category_id)
        .single();

      if (existing) {
        await supabase
          .from('user_sport_rankings')
          .update({
            total_sessions_played: (existing.total_sessions_played ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('user_sport_rankings').insert({
          user_id: uid,
          sport_category_id: session.sport_category_id,
          total_sessions_played: 1,
        });
      }
    }

    if (session.booking_id) {
      await supabase
        .from('bookings')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', session.booking_id);
    }

    revalidateSessionPaths(sessionId);
    revalidatePath('/my/bookings');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to mark session complete' };
  }
}
