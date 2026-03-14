import { type InferSelectModel } from 'drizzle-orm';
import {
  profiles,
  bookings,
  groupSessions,
  sessionParticipants,
  type participantStatusEnum,
  type bookingStatusEnum,
  type sessionVisibilityEnum,
} from './schema';

// ─── Inferred DB Row Types ─────────────────────────────────

export type Profile = InferSelectModel<typeof profiles>;
export type Booking = InferSelectModel<typeof bookings>;
export type GroupSession = InferSelectModel<typeof groupSessions>;
export type SessionParticipant = InferSelectModel<typeof sessionParticipants>;

export type ParticipantStatus = (typeof participantStatusEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type SessionVisibility = (typeof sessionVisibilityEnum.enumValues)[number];

// ─── Session Status (Computed) ─────────────────────────────

export type SessionStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';

/**
 * Derive the user-facing session status from DB columns.
 * The DB stores is_confirmed, is_cancelled, cancelled_reason, completed_at
 * separately — this function computes a single status label.
 */
export function getSessionStatus(session: {
  is_cancelled?: boolean | null;
  isCancelled?: boolean | null;
  cancelled_reason?: string | null;
  cancelledReason?: string | null;
  completed_at?: string | Date | null;
  completedAt?: string | Date | null;
  is_confirmed?: boolean | null;
  isConfirmed?: boolean | null;
  confirmation_deadline?: string | Date | null;
  confirmationDeadline?: string | Date | null;
}): SessionStatus {
  const isCancelled = session.is_cancelled ?? session.isCancelled ?? false;
  const cancelledReason = session.cancelled_reason ?? session.cancelledReason ?? null;
  const completedAt = session.completed_at ?? session.completedAt ?? null;
  const isConfirmed = session.is_confirmed ?? session.isConfirmed ?? false;
  const deadline = session.confirmation_deadline ?? session.confirmationDeadline ?? null;

  if (isCancelled && cancelledReason === 'deadline_expired') return 'expired';
  if (isCancelled) return 'cancelled';
  if (completedAt) return 'completed';
  if (isConfirmed) return 'active';

  if (deadline && new Date(String(deadline)) < new Date()) return 'expired';
  return 'draft';
}

/**
 * Map session status to display properties.
 */
export function getSessionStatusDisplay(status: SessionStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
    case 'active':
      return { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' };
    case 'completed':
      return { label: 'Completed', color: 'text-blue-700', bgColor: 'bg-blue-100' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' };
    case 'expired':
      return { label: 'Expired', color: 'text-gray-700', bgColor: 'bg-gray-100' };
  }
}

// ─── Availability / Join Checks ────────────────────────────

/**
 * Whether a user can request to join a session.
 * Checks: public, not cancelled, not full.
 * Does NOT check skill range or auth — those are done in the server action.
 */
export function canRequestToJoin(session: {
  visibility: string;
  is_cancelled?: boolean | null;
  isCancelled?: boolean | null;
  current_participants?: number;
  currentParticipants?: number;
  max_participants?: number;
  maxParticipants?: number;
  confirmation_deadline?: string | Date | null;
  confirmationDeadline?: string | Date | null;
  is_confirmed?: boolean | null;
  isConfirmed?: boolean | null;
}): boolean {
  const isCancelled = session.is_cancelled ?? session.isCancelled ?? false;
  const current = session.current_participants ?? session.currentParticipants ?? 0;
  const max = session.max_participants ?? session.maxParticipants ?? 0;
  const deadline = session.confirmation_deadline ?? session.confirmationDeadline ?? null;
  const isConfirmed = session.is_confirmed ?? session.isConfirmed ?? false;

  if (!isConfirmed && deadline && new Date(String(deadline)) < new Date()) return false;

  return session.visibility === 'public' && !isCancelled && current < max;
}

/**
 * Whether a session can be confirmed by the organizer.
 * Must be a draft (not confirmed, not cancelled).
 */
export function canConfirmSession(session: {
  is_confirmed?: boolean | null;
  isConfirmed?: boolean | null;
  is_cancelled?: boolean | null;
  isCancelled?: boolean | null;
}): boolean {
  const isConfirmed = session.is_confirmed ?? session.isConfirmed ?? false;
  const isCancelled = session.is_cancelled ?? session.isCancelled ?? false;
  return !isConfirmed && !isCancelled;
}

/**
 * Whether a session is still editable (not cancelled, not completed).
 */
export function canEditSession(session: {
  is_cancelled?: boolean | null;
  isCancelled?: boolean | null;
  completed_at?: string | Date | null;
  completedAt?: string | Date | null;
}): boolean {
  const isCancelled = session.is_cancelled ?? session.isCancelled ?? false;
  const completedAt = session.completed_at ?? session.completedAt ?? null;
  return !isCancelled && !completedAt;
}

// ─── Participant Status Display ────────────────────────────

export function getParticipantStatusDisplay(status: ParticipantStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', color: 'text-green-700', bgColor: 'bg-green-100' };
    case 'requested':
      return { label: 'Requested', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
    case 'invited':
      return { label: 'Invited', color: 'text-blue-700', bgColor: 'bg-blue-100' };
    case 'declined':
      return { label: 'Declined', color: 'text-red-700', bgColor: 'bg-red-100' };
    case 'waitlisted':
      return { label: 'Waitlisted', color: 'text-orange-700', bgColor: 'bg-orange-100' };
  }
}

// ─── Reusable Supabase Select Strings ──────────────────────
// Use these with supabase.from('table').select(CONSTANT)
// to ensure consistent column selection across all queries.

export const SESSION_SELECT = `
  id, field_id, booking_id, organizer_id, sport_category_id,
  title, description, visibility, date, start_time, end_time,
  max_participants, current_participants,
  price_per_person_eur, price_per_person_local,
  skill_level_min, skill_level_max,
  is_confirmed, confirmation_deadline, cancelled_reason,
  is_cancelled, completed_at, created_at
`.replace(/\s+/g, ' ').trim();

export const SESSION_WITH_RELATIONS_SELECT = `
  ${SESSION_SELECT},
  organizer:profiles!organizer_id(id, full_name, avatar_url, email),
  field:fields!field_id(id, name, slug, location_id,
    location:locations!location_id(id, name, slug, city, address,
      club:clubs!club_id(id, name, slug)
    )
  ),
  sport_category:sport_categories!sport_category_id(id, name, slug, icon, color_primary)
`.replace(/\s+/g, ' ').trim();

export const BOOKING_SELECT = `
  id, field_id, user_id, session_id, date, start_time, end_time,
  status, total_price_eur, total_price_local, notes, booked_by,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const BOOKING_WITH_RELATIONS_SELECT = `
  ${BOOKING_SELECT},
  field:fields!field_id(id, name, slug,
    location:locations!location_id(id, name, slug, city, address,
      club:clubs!club_id(id, name, slug)
    ),
    sport_category:sport_categories!sport_category_id(id, name, icon, color_primary)
  ),
  user:profiles!user_id(id, full_name, avatar_url, email)
`.replace(/\s+/g, ' ').trim();

export const PARTICIPANT_SELECT = `
  id, session_id, user_id, status, invited_by, joined_at,
  user:profiles!user_id(id, full_name, avatar_url, email, city)
`.replace(/\s+/g, ' ').trim();

// ─── Date/Time Helpers ─────────────────────────────────────

/**
 * Compute the confirmation deadline for a session:
 * 2 hours before start time on the session date.
 */
export function computeConfirmationDeadline(date: string, startTime: string): Date {
  const dateTime = new Date(`${date}T${startTime}`);
  dateTime.setHours(dateTime.getHours() - 2);
  return dateTime;
}

/**
 * Check if a session's confirmation deadline has passed.
 */
export function isDeadlinePassed(deadline: string | Date | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

// ─── Legacy Compatibility ──────────────────────────────────
// These stubs exist for the old starter template API routes.
// They can be removed once /api/team and /api/user are cleaned up.

export async function getUser() {
  return null;
}

export async function getTeamForUser() {
  return null;
}
