import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ─── Types ──────────────────────────────────────────

export interface SlotSession {
  id: string;
  title: string;
  organizerName: string;
  visibility: 'public' | 'private';
  isConfirmed: boolean;
  currentParticipants: number;
  maxParticipants: number;
  pricePerPersonEur: number;
  skillLevelMin: number;
  skillLevelMax: number;
  sportCategoryName: string;
  sportCategoryIcon: string;
}

export interface TimeSlot {
  startTime: string;     // "09:00"
  endTime: string;       // "10:00"
  status: 'available' | 'booked' | 'blocked' | 'past' | 'closed';
  priceEur: number | null;
  priceLocal: number | null;
  bookingId?: string;
  blockReason?: string;
  sessions: SlotSession[];
}

export interface FieldBookingInfo {
  slotDurationMinutes: number;
  bufferMinutes: number;
  pricePerSlotEur: number;
  pricePerSlotLocal: number | null;
  currency: string;
  minBookingNoticeHours: number;
  maxBookingAdvanceDays: number;
  autoConfirm: boolean;
}

// ─── Helpers ────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
}

function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return dateStr === `${y}-${m}-${d}`;
}

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ─── Availability range merging ─────────────────────

interface TimeRange {
  start: number; // minutes
  end: number;
  isAvailable: boolean;
  reason?: string;
  fromOverride: boolean;
}

function buildAvailableRanges(
  openMin: number,
  closeMin: number,
  overrides: { start: number; end: number; isAvailable: boolean; reason?: string }[],
  defaultAvailable: boolean = true
): TimeRange[] {
  if (overrides.length === 0) {
    return [{ start: openMin, end: closeMin, isAvailable: defaultAvailable, fromOverride: false }];
  }

  const sorted = [...overrides].sort((a, b) => a.start - b.start);
  const ranges: TimeRange[] = [];
  let cursor = openMin;

  for (const ovr of sorted) {
    const ovrStart = Math.max(ovr.start, openMin);
    const ovrEnd = Math.min(ovr.end, closeMin);
    if (ovrStart >= ovrEnd) continue;

    if (cursor < ovrStart) {
      ranges.push({ start: cursor, end: ovrStart, isAvailable: defaultAvailable, fromOverride: false });
    }
    ranges.push({ start: ovrStart, end: ovrEnd, isAvailable: ovr.isAvailable, reason: ovr.reason, fromOverride: true });
    cursor = Math.max(cursor, ovrEnd);
  }

  if (cursor < closeMin) {
    ranges.push({ start: cursor, end: closeMin, isAvailable: defaultAvailable, fromOverride: false });
  }

  return ranges;
}

function getSlotRangeInfo(
  minute: number,
  slotEnd: number,
  ranges: TimeRange[]
): { isAvailable: boolean; reason?: string; fromOverride: boolean } {
  for (const r of ranges) {
    if (minute >= r.start && slotEnd <= r.end) {
      return { isAvailable: r.isAvailable, reason: r.reason, fromOverride: r.fromOverride };
    }
  }
  return { isAvailable: false, fromOverride: false };
}

// ─── Main algorithm ─────────────────────────────────

/**
 * Generates time slots for a given field on a given date.
 * Follows the algorithm from SPORTLY-BLUEPRINT.md Section 11:
 *
 * 1. Get location schedule for this day_of_week -> open/close or closed
 * 2. Get field booking settings -> duration, buffer, price, notice, advance
 * 3. Validate booking window (max_advance, min_notice)
 * 4. Get field availability overrides -> build available time ranges
 * 5. Generate slot grid from open to close, stepping by (duration + buffer)
 * 6. Fetch CONFIRMED bookings -> mark overlapping slots as booked (with bookingId)
 *    NOTE: Only confirmed bookings block slots. Draft sessions do NOT block.
 * 7. Mark past slots (if today)
 * 8. Fetch public group sessions -> attach matching sessions[] to each slot
 * 9. Return slot array with sessions attached
 */
export async function getAvailableSlots(
  fieldId: string,
  date: string
): Promise<TimeSlot[]> {
  // All queries use supabaseAdmin (service role) to bypass RLS.
  // The regular server client is subject to RLS, which means logged-out users
  // see zero bookings and logged-in users only see their own — causing every
  // slot to appear "available". Slot availability must reflect ALL bookings.

  // ── 0. Get field + location ──
  const { data: field } = await supabaseAdmin
    .from('fields')
    .select('id, location_id, is_active')
    .eq('id', fieldId)
    .single();

  if (!field) return [];
  if (!field.is_active) return [];

  const dayOfWeek = getDayOfWeek(date);

  // ── 1. Get location schedule for this weekday ──
  const { data: locSched } = await supabaseAdmin
    .from('location_schedules')
    .select('open_time, close_time, is_closed')
    .eq('location_id', field.location_id)
    .eq('day_of_week', dayOfWeek)
    .single();

  const locationClosed = locSched?.is_closed ?? false;
  const baseOpen = locSched?.open_time ?? '08:00';
  const baseClose = locSched?.close_time ?? '22:00';

  // ── 2. Get field booking settings ──
  const { data: settings } = await supabaseAdmin
    .from('field_booking_settings')
    .select('*')
    .eq('field_id', fieldId)
    .single();

  const slotDuration = settings?.slot_duration_minutes ?? 60;
  const buffer = settings?.buffer_minutes ?? 0;
  const priceEur = settings?.price_per_slot_eur != null ? Number(settings.price_per_slot_eur) : null;
  const priceLocal = settings?.price_per_slot_local != null ? Number(settings.price_per_slot_local) : null;
  const minNoticeHours = settings?.min_booking_notice_hours ?? 1;
  const maxAdvanceDays = settings?.max_booking_advance_days ?? 30;

  // ── 3. Validate booking window ──
  const today = todayStr();
  const maxDate = addDays(today, maxAdvanceDays);
  if (date > maxDate) return [];
  if (date < today) return [];

  const isTodayDate = isToday(date);
  const nowMin = getNowMinutes();
  const earliestSlotMin = isTodayDate ? nowMin + minNoticeHours * 60 : 0;

  // ── 4. Get field availability overrides (BEFORE location-closed check) ──
  // Query both specific-date and day-of-week overrides; include reason column.
  const { data: fieldAvail } = await supabaseAdmin
    .from('field_availability')
    .select('day_of_week, specific_date, start_time, end_time, is_available, reason')
    .eq('field_id', fieldId)
    .or(`day_of_week.eq.${dayOfWeek},specific_date.eq.${date}`);

  const dateSpecific = (fieldAvail ?? []).filter((a) => a.specific_date === date);
  const weeklyRules = (fieldAvail ?? []).filter(
    (a) => a.day_of_week === dayOfWeek && !a.specific_date
  );

  // Date-specific overrides take full precedence over weekly rules
  const applicableOverrides = dateSpecific.length > 0 ? dateSpecific : weeklyRules;

  // ── 4a. Handle location-closed case ──
  // If location is closed, field-level is_available=true overrides can still
  // open specific time ranges. If no such overrides exist, return all closed.
  if (locationClosed) {
    const hasAvailableOverride = applicableOverrides.some((a) => a.is_available);
    if (!hasAvailableOverride) {
      return buildClosedSlots(baseOpen, baseClose, slotDuration);
    }
  }

  const openMin = timeToMinutes(baseOpen);
  const closeMin = timeToMinutes(baseClose);

  const overrideRanges = applicableOverrides.map((a) => ({
    start: timeToMinutes(a.start_time),
    end: timeToMinutes(a.end_time),
    isAvailable: a.is_available ?? true,
    reason: a.reason ?? undefined,
  }));

  // When location is closed, default is unavailable — only explicit
  // is_available=true overrides open time windows.
  // When location is open, default is available — is_available=false
  // overrides block specific ranges.
  const defaultAvailable = !locationClosed;
  const availRanges = buildAvailableRanges(openMin, closeMin, overrideRanges, defaultAvailable);

  // ── 5. Generate slot grid ──
  const step = slotDuration + buffer;
  const slots: TimeSlot[] = [];

  for (let m = openMin; m + slotDuration <= closeMin; m += step) {
    const slotEnd = m + slotDuration;
    const startTime = minutesToTime(m);
    const endTime = minutesToTime(slotEnd);

    const rangeInfo = getSlotRangeInfo(m, slotEnd, availRanges);

    if (!rangeInfo.isAvailable) {
      // Explicit field override → 'blocked' (with optional reason).
      // Location-closed default gap → 'closed'.
      const status = rangeInfo.fromOverride ? 'blocked' : (locationClosed ? 'closed' : 'blocked');
      slots.push({
        startTime,
        endTime,
        status,
        priceEur: null,
        priceLocal: null,
        blockReason: rangeInfo.reason,
        sessions: [],
      });
      continue;
    }

    slots.push({
      startTime,
      endTime,
      status: 'available',
      priceEur,
      priceLocal,
      sessions: [],
    });
  }

  // ── 6. Fetch ALL non-cancelled bookings -> mark overlapping slots as booked ──
  // Uses .neq('status', 'cancelled') so pending, confirmed, and completed
  // bookings all block their slots.
  const { data: existingBookings } = await supabaseAdmin
    .from('bookings')
    .select('id, start_time, end_time, status')
    .eq('field_id', fieldId)
    .eq('date', date)
    .neq('status', 'cancelled');

  const bookedMap = new Map<string, string>();
  (existingBookings ?? []).forEach((b) => {
    const bStart = timeToMinutes(b.start_time);
    const bEnd = timeToMinutes(b.end_time);
    for (const slot of slots) {
      const sStart = timeToMinutes(slot.startTime);
      const sEnd = timeToMinutes(slot.endTime);
      if (sStart < bEnd && sEnd > bStart) {
        bookedMap.set(slot.startTime, b.id);
      }
    }
  });

  for (const slot of slots) {
    const bId = bookedMap.get(slot.startTime);
    if (slot.status === 'available' && bId) {
      slot.status = 'booked';
      slot.bookingId = bId;
    }
  }

  // ── 7. Mark past slots (if today) ──
  if (isTodayDate) {
    for (const slot of slots) {
      const slotMin = timeToMinutes(slot.startTime);
      if (slotMin < earliestSlotMin && slot.status === 'available') {
        slot.status = 'past';
      }
    }
  }

  // ── 8. Fetch public group sessions (active + non-expired drafts) → attach to overlapping slots ──
  const nowIso = new Date().toISOString();
  const { data: publicSessions } = await supabaseAdmin
    .from('group_sessions')
    .select(`
      id, title, visibility, is_confirmed, date, start_time, end_time,
      current_participants, max_participants,
      price_per_person_eur, skill_level_min, skill_level_max,
      organizer:profiles!organizer_id(full_name),
      sport_category:sport_categories!sport_category_id(name, icon)
    `)
    .eq('field_id', fieldId)
    .eq('date', date)
    .eq('is_cancelled', false)
    .eq('visibility', 'public')
    .or(`is_confirmed.eq.true,confirmation_deadline.is.null,confirmation_deadline.gt.${nowIso}`);

  if (publicSessions && publicSessions.length > 0) {
    for (const gs of publicSessions) {
      const gsStart = timeToMinutes(gs.start_time);
      const gsEnd = timeToMinutes(gs.end_time);

      const slotSession: SlotSession = {
        id: gs.id,
        title: gs.title,
        organizerName: (gs.organizer as any)?.full_name ?? 'Unknown',
        visibility: gs.visibility as 'public' | 'private',
        isConfirmed: gs.is_confirmed ?? false,
        currentParticipants: gs.current_participants ?? 0,
        maxParticipants: gs.max_participants ?? 0,
        pricePerPersonEur: Number(gs.price_per_person_eur ?? 0),
        skillLevelMin: Number(gs.skill_level_min ?? 0),
        skillLevelMax: Number(gs.skill_level_max ?? 5),
        sportCategoryName: (gs.sport_category as any)?.name ?? '',
        sportCategoryIcon: (gs.sport_category as any)?.icon ?? '',
      };

      for (const slot of slots) {
        const sStart = timeToMinutes(slot.startTime);
        const sEnd = timeToMinutes(slot.endTime);
        if (sStart < gsEnd && sEnd > gsStart) {
          slot.sessions.push(slotSession);
        }
      }
    }
  }

  // ── 9. Return slot array with sessions attached ──
  return slots;
}

/**
 * Returns a set of "closed" slots to give visual feedback on the grid.
 */
function buildClosedSlots(open: string, close: string, duration: number): TimeSlot[] {
  const openMin = timeToMinutes(open);
  const closeMin = timeToMinutes(close);
  const slots: TimeSlot[] = [];

  for (let m = openMin; m + duration <= closeMin; m += duration) {
    slots.push({
      startTime: minutesToTime(m),
      endTime: minutesToTime(m + duration),
      status: 'closed',
      priceEur: null,
      priceLocal: null,
      sessions: [],
    });
  }

  return slots;
}

/**
 * Fetch booking settings for a field.
 * Used by booking actions for price lookups and validation.
 */
export async function getFieldBookingInfo(
  fieldId: string
): Promise<FieldBookingInfo | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('field_booking_settings')
    .select('*')
    .eq('field_id', fieldId)
    .single();

  if (!data) return null;

  return {
    slotDurationMinutes: data.slot_duration_minutes,
    bufferMinutes: data.buffer_minutes ?? 0,
    pricePerSlotEur: Number(data.price_per_slot_eur),
    pricePerSlotLocal: data.price_per_slot_local != null ? Number(data.price_per_slot_local) : null,
    currency: data.currency_local ?? 'BGN',
    minBookingNoticeHours: data.min_booking_notice_hours ?? 1,
    maxBookingAdvanceDays: data.max_booking_advance_days ?? 30,
    autoConfirm: data.auto_confirm ?? true,
  };
}
