import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireAuth();
  if (user.role !== 'super_admin') redirect('/');
  return user;
}

export async function getCurrentUserWithClubRole(clubId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .single();

  return { ...user, clubRole: membership?.role ?? null };
}

export async function requireClubAccess(clubId: string) {
  const user = await requireAuth();

  if (user.role === 'super_admin')
    return { ...user, clubRole: 'club_admin' as const };

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .single();

  if (!membership) redirect('/');
  return { ...user, clubRole: membership.role };
}
