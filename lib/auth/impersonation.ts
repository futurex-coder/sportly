import { cookies } from 'next/headers';
import { getCurrentUser } from './helpers';
import { createClient } from '@/lib/supabase/server';

// ─── Club Impersonation (Super Admin → Club) ──────

export async function setImpersonatedClub(clubId: string) {
  const cookieStore = await cookies();
  cookieStore.set('impersonated_club_id', clubId, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
  });
}

export async function getImpersonatedClubId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('impersonated_club_id')?.value ?? null;
}

export async function clearImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete('impersonated_club_id');
}

// ─── Location Scoping (Club Admin → Location) ─────

export async function setActiveLocation(locationId: string | null) {
  const cookieStore = await cookies();
  if (locationId) {
    cookieStore.set('active_location_id', locationId, {
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  } else {
    cookieStore.delete('active_location_id');
  }
}

export async function getActiveLocationId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('active_location_id')?.value ?? null;
}

// ─── Get Active Club (universal) ───────────────────

export async function getActiveClubId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === 'super_admin') {
    return await getImpersonatedClubId();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single();

  return data?.club_id ?? null;
}
