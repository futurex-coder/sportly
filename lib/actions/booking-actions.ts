'use server';

import { revalidatePath } from 'next/cache';
import { requireClubAccess, getCurrentUser } from '@/lib/auth/helpers';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import {
  getAvailableSlots as computeSlots,
  getFieldBookingInfo,
  type TimeSlot,
} from '@/lib/booking/slot-generator';
import type { ActionResult } from './types';

// ─── Helpers ────────────────────────────────────────

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function insertBookingSafe(params: {
  fieldId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  priceEur: number | null;
  priceLocal: number | null;
  sessionId?: string | null;
  bookedBy?: string | null;
  notes?: string | null;
}): Promise<{ bookingId: string | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_booking_safe', {
    p_field_id: params.fieldId,
    p_user_id: params.userId,
    p_date: params.date,
    p_start_time: params.startTime,
    p_end_time: params.endTime,
    p_price_eur: params.priceEur,
    p_price_local: params.priceLocal,
    p_session_id: params.sessionId ?? null,
    p_booked_by: params.bookedBy ?? null,
    p_notes: params.notes ?? null,
  });

  if (error) {
    if (error.message.includes('SLOT_ALREADY_BOOKED')) {
      return { bookingId: null, error: 'This slot is already booked.' };
    }
    return { bookingId: null, error: error.message };
  }

  return { bookingId: data as string, error: null };
}

async function resolveBookingParams(fieldId: string) {
  const info = await getFieldBookingInfo(fieldId);
  return {
    priceEur: info?.pricePerSlotEur ?? null,
    priceLocal: info?.pricePerSlotLocal ?? null,
    minNoticeHours: info?.minBookingNoticeHours ?? 1,
    maxAdvanceDays: info?.maxBookingAdvanceDays ?? 30,
    cancellationPolicyHours: 24,
  };
}

async function getCancellationHours(fieldId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('field_booking_settings')
    .select('cancellation_policy_hours')
    .eq('field_id', fieldId)
    .single();
  return data?.cancellation_policy_hours ?? 24;
}

function validateBookingWindow(
  date: string,
  startTime: string,
  maxAdvanceDays: number,
  minNoticeHours: number
): string | null {
  const today = todayStr();
  if (date < today) return 'Cannot book in the past.';

  const bookDate = new Date(date + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.ceil((bookDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > maxAdvanceDays) {
    return `Cannot book more than ${maxAdvanceDays} days in advance.`;
  }

  if (date === today) {
    const slotMin = timeToMinutes(startTime);
    if (slotMin < nowMinutes() + minNoticeHours * 60) {
      return `Minimum ${minNoticeHours}h notice required.`;
    }
  }

  return null;
}

// ─── Slot query (server action wrapper) ─────────────

export async function getAvailableSlots(
  fieldId: string,
  date: string
): Promise<{ slots: TimeSlot[]; error: string | null }> {
  try {
    const slots = await computeSlots(fieldId, date);
    return { slots, error: null };
  } catch (e: any) {
    return { slots: [], error: e.message ?? 'Failed to fetch slots' };
  }
}

// ─── Public booking (end-user) ──────────────────────

export async function createPublicBooking(data: {
  fieldId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: 'Please sign in to book.' };

    const params = await resolveBookingParams(data.fieldId);

    const windowErr = validateBookingWindow(
      data.date, data.startTime, params.maxAdvanceDays, params.minNoticeHours
    );
    if (windowErr) return { success: false, error: windowErr };

    const result = await insertBookingSafe({
      fieldId: data.fieldId,
      userId: currentUser.id,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      priceEur: params.priceEur,
      priceLocal: params.priceLocal,
      notes: data.notes ?? null,
      bookedBy: currentUser.id,
    });

    if (result.error) return { success: false, error: result.error };

    revalidatePath('/');
    revalidatePath('/my/bookings');
    return { success: true, data: { bookingId: result.bookingId! } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create booking' };
  }
}

// ─── Dashboard manual booking (club admin) ──────────

export async function createManualBooking(data: {
  fieldId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPriceEur?: number;
  totalPriceLocal?: number;
  notes?: string;
}): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    const admin = await requireClubAccess(clubId);

    const params = await resolveBookingParams(data.fieldId);
    const priceEur = data.totalPriceEur ?? params.priceEur;
    const priceLocal = data.totalPriceLocal ?? params.priceLocal;

    const result = await insertBookingSafe({
      fieldId: data.fieldId,
      userId: data.userId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      priceEur,
      priceLocal,
      notes: data.notes ?? null,
      bookedBy: admin.id,
    });

    if (result.error) return { success: false, error: result.error };

    revalidatePath('/dashboard/bookings');
    return { success: true, data: { bookingId: result.bookingId! } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create booking' };
  }
}

// ─── Legacy alias used by bookings-client ───────────

export async function createBooking(data: {
  fieldId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPriceEur?: number;
  totalPriceLocal?: number;
  notes?: string;
}) {
  return createManualBooking(data);
}

// ─── Cancel booking ─────────────────────────────────

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, user_id, field_id, session_id, date, start_time, status')
      .eq('id', bookingId)
      .single();

    if (!booking) return { success: false, error: 'Booking not found' };
    if (booking.status === 'cancelled') return { success: false, error: 'Already cancelled' };
    if (booking.status === 'completed') return { success: false, error: 'Cannot cancel a completed booking' };

    const isOwner = booking.user_id === currentUser.id;

    if (!isOwner) {
      const { data: field } = await supabase
        .from('fields')
        .select('location_id, locations(club_id)')
        .eq('id', booking.field_id)
        .single();

      const clubId = (field?.locations as any)?.club_id;
      if (!clubId) return { success: false, error: 'Permission denied' };

      try {
        await requireClubAccess(clubId);
      } catch {
        return { success: false, error: 'Permission denied' };
      }
    }

    if (isOwner) {
      const policyHours = await getCancellationHours(booking.field_id);
      const bookingTime = new Date(`${booking.date}T${booking.start_time}`);
      const hoursUntil = (bookingTime.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntil < policyHours) {
        return { success: false, error: `Cannot cancel less than ${policyHours}h before the booking.` };
      }
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (error) return { success: false, error: error.message };

    if (booking.session_id) {
      await supabase
        .from('group_sessions')
        .update({
          is_cancelled: true,
          cancelled_reason: 'manual',
          booking_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.session_id);
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath('/my/bookings');
    revalidatePath('/my/sessions');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to cancel booking' };
  }
}

// ─── Update status (admin quick-actions) ────────────

export async function updateBookingStatus(
  bookingId: string,
  status: 'confirmed' | 'cancelled' | 'completed'
): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/bookings');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update booking status' };
  }
}
