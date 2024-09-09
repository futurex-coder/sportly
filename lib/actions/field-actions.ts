'use server';

import { revalidatePath } from 'next/cache';
import { requireClubAccess } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { ActionResult } from './types';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface BookingSettings {
  slotDurationMinutes: number;
  bufferMinutes: number;
  pricePerSlotEur: number;
  pricePerSlotLocal?: number;
  minBookingNoticeHours: number;
  maxBookingAdvanceDays: number;
  autoConfirm: boolean;
  cancellationPolicyHours: number;
}

interface AvailabilityRule {
  dayOfWeek?: string;
  specificDate?: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
}

async function getClubIdForLocation(locationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('club_id')
    .eq('id', locationId)
    .single();
  return data?.club_id ?? null;
}

export async function createField(data: {
  locationId: string;
  name: string;
  sportCategoryId: string;
  description?: string;
  attributes: { key: string; value: string }[];
  bookingSettings: BookingSettings;
  availability?: AvailabilityRule[];
}): Promise<ActionResult<{ fieldId: string }>> {
  try {
    const clubId = await getClubIdForLocation(data.locationId);
    if (!clubId) return { success: false, error: 'Location not found' };
    await requireClubAccess(clubId);

    const supabase = await createClient();
    const slug = generateSlug(data.name);

    const { data: field, error } = await supabase
      .from('fields')
      .insert({
        location_id: data.locationId,
        sport_category_id: data.sportCategoryId,
        name: data.name,
        slug,
        description: data.description ?? null,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };

    if (data.attributes.length > 0) {
      const attrRows = data.attributes
        .filter((a) => a.key && a.value)
        .map((a) => ({
          field_id: field.id,
          attribute_key: a.key,
          attribute_value: a.value,
        }));

      if (attrRows.length > 0) {
        const { error: attrError } = await supabase
          .from('field_attributes')
          .insert(attrRows);
        if (attrError) return { success: false, error: attrError.message, data: { fieldId: field.id } };
      }
    }

    const { error: settingsError } = await supabase
      .from('field_booking_settings')
      .insert({
        field_id: field.id,
        slot_duration_minutes: data.bookingSettings.slotDurationMinutes,
        buffer_minutes: data.bookingSettings.bufferMinutes,
        price_per_slot_eur: data.bookingSettings.pricePerSlotEur,
        price_per_slot_local: data.bookingSettings.pricePerSlotLocal ?? null,
        min_booking_notice_hours: data.bookingSettings.minBookingNoticeHours,
        max_booking_advance_days: data.bookingSettings.maxBookingAdvanceDays,
        auto_confirm: data.bookingSettings.autoConfirm,
        cancellation_policy_hours: data.bookingSettings.cancellationPolicyHours,
      });

    if (settingsError) return { success: false, error: settingsError.message, data: { fieldId: field.id } };

    if (data.availability && data.availability.length > 0) {
      const availRows = data.availability.map((a) => ({
        field_id: field.id,
        day_of_week: a.dayOfWeek ?? null,
        specific_date: a.specificDate ?? null,
        start_time: a.startTime,
        end_time: a.endTime,
        is_available: a.isAvailable,
        reason: a.reason ?? null,
      }));

      const { error: availError } = await supabase
        .from('field_availability')
        .insert(availRows);
      if (availError) return { success: false, error: availError.message, data: { fieldId: field.id } };
    }

    revalidatePath(`/dashboard/locations/${data.locationId}`);
    return { success: true, data: { fieldId: field.id } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create field' };
  }
}

export async function updateField(
  fieldId: string,
  data: {
    name?: string;
    sportCategoryId?: string;
    description?: string;
    coverImageUrl?: string;
    isActive?: boolean;
  }
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: field } = await supabase
      .from('fields')
      .select('location_id')
      .eq('id', fieldId)
      .single();
    if (!field) return { success: false, error: 'Field not found' };

    const clubId = await getClubIdForLocation(field.location_id);
    if (!clubId) return { success: false, error: 'Location not found' };
    await requireClubAccess(clubId);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) {
      updates.name = data.name;
      updates.slug = generateSlug(data.name);
    }
    if (data.sportCategoryId !== undefined) updates.sport_category_id = data.sportCategoryId;
    if (data.description !== undefined) updates.description = data.description;
    if (data.coverImageUrl !== undefined) updates.cover_image_url = data.coverImageUrl;
    if (data.isActive !== undefined) updates.is_active = data.isActive;

    const { error } = await supabase.from('fields').update(updates).eq('id', fieldId);
    if (error) return { success: false, error: error.message };

    revalidatePath(`/dashboard/locations/${field.location_id}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update field' };
  }
}

export async function updateFieldAttributes(
  fieldId: string,
  attributes: { key: string; value: string }[]
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: field } = await supabase
      .from('fields')
      .select('location_id')
      .eq('id', fieldId)
      .single();
    if (!field) return { success: false, error: 'Field not found' };

    const clubId = await getClubIdForLocation(field.location_id);
    if (!clubId) return { success: false, error: 'Location not found' };
    await requireClubAccess(clubId);

    const { error: delError } = await supabase
      .from('field_attributes')
      .delete()
      .eq('field_id', fieldId);
    if (delError) return { success: false, error: delError.message };

    const rows = attributes
      .filter((a) => a.key && a.value)
      .map((a) => ({
        field_id: fieldId,
        attribute_key: a.key,
        attribute_value: a.value,
      }));

    if (rows.length > 0) {
      const { error: insError } = await supabase
        .from('field_attributes')
        .insert(rows);
      if (insError) return { success: false, error: insError.message };
    }

    revalidatePath(`/dashboard/locations/${field.location_id}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update attributes' };
  }
}

export async function updateFieldBookingSettings(
  fieldId: string,
  settings: BookingSettings
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: field } = await supabase
      .from('fields')
      .select('location_id')
      .eq('id', fieldId)
      .single();
    if (!field) return { success: false, error: 'Field not found' };

    const clubId = await getClubIdForLocation(field.location_id);
    if (!clubId) return { success: false, error: 'Location not found' };
    await requireClubAccess(clubId);

    const { error } = await supabase
      .from('field_booking_settings')
      .upsert(
        {
          field_id: fieldId,
          slot_duration_minutes: settings.slotDurationMinutes,
          buffer_minutes: settings.bufferMinutes,
          price_per_slot_eur: settings.pricePerSlotEur,
          price_per_slot_local: settings.pricePerSlotLocal ?? null,
          min_booking_notice_hours: settings.minBookingNoticeHours,
          max_booking_advance_days: settings.maxBookingAdvanceDays,
          auto_confirm: settings.autoConfirm,
          cancellation_policy_hours: settings.cancellationPolicyHours,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'field_id' }
      );

    if (error) return { success: false, error: error.message };

    revalidatePath(`/dashboard/locations/${field.location_id}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update booking settings' };
  }
}

export async function updateFieldAvailability(
  fieldId: string,
  availability: AvailabilityRule[]
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: field } = await supabase
      .from('fields')
      .select('location_id')
      .eq('id', fieldId)
      .single();
    if (!field) return { success: false, error: 'Field not found' };

    const clubId = await getClubIdForLocation(field.location_id);
    if (!clubId) return { success: false, error: 'Location not found' };
    await requireClubAccess(clubId);

    const { error: delError } = await supabase
      .from('field_availability')
      .delete()
      .eq('field_id', fieldId);
    if (delError) return { success: false, error: delError.message };

    if (availability.length > 0) {
      const rows = availability.map((a) => ({
        field_id: fieldId,
        day_of_week: a.dayOfWeek ?? null,
        specific_date: a.specificDate ?? null,
        start_time: a.startTime,
        end_time: a.endTime,
        is_available: a.isAvailable,
        reason: a.reason ?? null,
      }));

      const { error: insError } = await supabase
        .from('field_availability')
        .insert(rows);
      if (insError) return { success: false, error: insError.message };
    }

    revalidatePath(`/dashboard/locations/${field.location_id}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update availability' };
  }
}

export async function deleteField(fieldId: string): Promise<ActionResult> {
  let locationId: string | undefined;
  try {
    const supabase = await createClient();

    const { data: field } = await supabase
      .from('fields')
      .select('location_id')
      .eq('id', fieldId)
      .single();
    if (!field) return { success: false, error: 'Field not found' };
    locationId = field.location_id;

    const clubId = await getClubIdForLocation(field.location_id);
    if (!clubId) return { success: false, error: 'Location not found' };
    await requireClubAccess(clubId);

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('field_id', fieldId)
      .in('status', ['pending', 'confirmed']);

    if (count && count > 0) {
      return { success: false, error: `Cannot delete: field has ${count} active booking(s). Cancel them first.` };
    }

    const { error } = await supabase.from('fields').delete().eq('id', fieldId);
    if (error) return { success: false, error: error.message };

    revalidatePath(`/dashboard/locations/${field.location_id}`);
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to delete field' };
  }

  redirect(`/dashboard/locations/${locationId}`);
}
