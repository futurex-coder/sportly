'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAvailableSlots,
  getFieldBookingInfo,
  type TimeSlot,
  type FieldBookingInfo,
} from '@/lib/booking/slot-generator';

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export interface FieldSchedule {
  field: {
    id: string;
    name: string;
    slug: string;
    sportCategory: { id: string; name: string; icon: string | null } | null;
    attributes: Record<string, string>;
  };
  bookingSettings: {
    slotDurationMinutes: number;
    pricePerSlotEur: number;
    pricePerSlotLocal: number | null;
    currency: string;
    autoConfirm: boolean;
  } | null;
  slots: TimeSlot[];
}

export async function getScheduleForDate(
  locationId: string,
  date: string
): Promise<FieldSchedule[]> {
  const supabase = await createClient();

  // 1. Get all active fields for this location
  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, slug, sport_category_id, sport_categories(id, name, icon)')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('sort_order');

  if (!fields || fields.length === 0) return [];

  const fieldIds = fields.map((f) => f.id);

  // Batch-fetch attributes for all fields
  const { data: allAttributes } = await supabase
    .from('field_attributes')
    .select('field_id, attribute_key, attribute_value')
    .in('field_id', fieldIds);

  const attrMap: Record<string, Record<string, string>> = {};
  (allAttributes ?? []).forEach((a) => {
    if (!attrMap[a.field_id]) attrMap[a.field_id] = {};
    attrMap[a.field_id][a.attribute_key] = a.attribute_value;
  });

  // 2. For each field, get slots + booking settings in parallel
  const results = await Promise.all(
    fields.map(async (f) => {
      const [slots, info] = await Promise.all([
        getAvailableSlots(f.id, date),
        getFieldBookingInfo(f.id),
      ]);

      const sc = f.sport_categories as { id: string; name: string; icon: string | null } | null;

      return {
        field: {
          id: f.id,
          name: f.name,
          slug: f.slug,
          sportCategory: sc,
          attributes: attrMap[f.id] ?? {},
        },
        bookingSettings: info
          ? {
              slotDurationMinutes: info.slotDurationMinutes,
              pricePerSlotEur: info.pricePerSlotEur,
              pricePerSlotLocal: info.pricePerSlotLocal,
              currency: info.currency,
              autoConfirm: info.autoConfirm,
            }
          : null,
        slots,
      } satisfies FieldSchedule;
    })
  );

  return results;
}

/**
 * Search forward from afterDate to find the next date with at least one
 * available slot across any field at this location. Returns the date and
 * its full schedule so the caller can render immediately without re-fetching.
 */
export async function findNextAvailableDate(
  locationId: string,
  afterDate: string,
  maxDays: number = 30
): Promise<{ date: string; schedule: FieldSchedule[] } | null> {
  const { data: fields } = await supabaseAdmin
    .from('fields')
    .select('id')
    .eq('location_id', locationId)
    .eq('is_active', true);

  if (!fields || fields.length === 0) return null;

  for (let i = 1; i <= maxDays; i++) {
    const dateStr = addDaysStr(afterDate, i);

    const slotResults = await Promise.all(
      fields.map((f) => getAvailableSlots(f.id, dateStr))
    );

    const hasAvailable = slotResults.some((slots) =>
      slots.some((s) => s.status === 'available')
    );

    if (hasAvailable) {
      const schedule = await getScheduleForDate(locationId, dateStr);
      return { date: dateStr, schedule };
    }
  }

  return null;
}
