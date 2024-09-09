'use server';

import { revalidatePath } from 'next/cache';
import { requireClubAccess } from '@/lib/auth/helpers';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { ActionResult } from './types';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  name: string,
  excludeLocationId?: string
): Promise<string> {
  const baseSlug = toSlug(name);

  let query = supabase
    .from('locations')
    .select('slug')
    .eq('club_id', clubId)
    .like('slug', `${baseSlug}%`);

  if (excludeLocationId) {
    query = query.neq('id', excludeLocationId);
  }

  const { data: existing } = await query;

  if (!existing || existing.length === 0) return baseSlug;

  const taken = new Set(existing.map((r: { slug: string }) => r.slug));
  if (!taken.has(baseSlug)) return baseSlug;

  let counter = 2;
  while (taken.has(`${baseSlug}-${counter}`)) counter++;
  return `${baseSlug}-${counter}`;
}

interface ScheduleDay {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export async function createLocation(data: {
  clubId: string;
  name: string;
  address: string;
  city: string;
  country?: string;
  phone?: string;
  email?: string;
  description?: string;
  schedule: ScheduleDay[];
}): Promise<ActionResult<{ locationId: string }>> {
  try {
    await requireClubAccess(data.clubId);
    const supabase = await createClient();

    const slug = await generateUniqueSlug(supabase, data.clubId, data.name);

    const { data: location, error } = await supabase
      .from('locations')
      .insert({
        club_id: data.clubId,
        name: data.name,
        slug,
        address: data.address,
        city: data.city,
        country: data.country ?? 'Bulgaria',
        phone: data.phone ?? null,
        email: data.email ?? null,
        description: data.description ?? null,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };

    if (data.schedule.length > 0) {
      const scheduleRows = data.schedule.map((s) => ({
        location_id: location.id,
        day_of_week: s.dayOfWeek,
        open_time: s.openTime,
        close_time: s.closeTime,
        is_closed: s.isClosed,
      }));

      const { error: schedError } = await supabase
        .from('location_schedules')
        .insert(scheduleRows);

      if (schedError) return { success: false, error: schedError.message, data: { locationId: location.id } };
    }

    revalidatePath('/dashboard/locations');
    return { success: true, data: { locationId: location.id } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create location' };
  }
}

export async function updateLocation(
  locationId: string,
  data: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    description?: string;
    coverImageUrl?: string;
  }
): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) {
      updates.name = data.name;
      updates.slug = await generateUniqueSlug(supabase, clubId, data.name, locationId);
    }
    if (data.address !== undefined) updates.address = data.address;
    if (data.city !== undefined) updates.city = data.city;
    if (data.country !== undefined) updates.country = data.country;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.email !== undefined) updates.email = data.email;
    if (data.description !== undefined) updates.description = data.description;
    if (data.coverImageUrl !== undefined) updates.cover_image_url = data.coverImageUrl;

    const { error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', locationId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/locations');
    revalidatePath(`/dashboard/locations/${locationId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update location' };
  }
}

export async function updateLocationSchedule(
  locationId: string,
  schedule: ScheduleDay[]
): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { error: delError } = await supabase
      .from('location_schedules')
      .delete()
      .eq('location_id', locationId);

    if (delError) return { success: false, error: delError.message };

    if (schedule.length > 0) {
      const rows = schedule.map((s) => ({
        location_id: locationId,
        day_of_week: s.dayOfWeek,
        open_time: s.openTime,
        close_time: s.closeTime,
        is_closed: s.isClosed,
      }));

      const { error: insError } = await supabase
        .from('location_schedules')
        .insert(rows);

      if (insError) return { success: false, error: insError.message };
    }

    revalidatePath(`/dashboard/locations/${locationId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update schedule' };
  }
}

export async function deleteLocation(locationId: string): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { count } = await supabase
      .from('fields')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId);

    if (count && count > 0) {
      return { success: false, error: `Cannot delete: location has ${count} field(s). Remove them first.` };
    }

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/locations');
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to delete location' };
  }

  redirect('/dashboard/locations');
}

export async function toggleLocationActive(locationId: string, isActive: boolean): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { error } = await supabase
      .from('locations')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', locationId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/locations');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to toggle location status' };
  }
}
