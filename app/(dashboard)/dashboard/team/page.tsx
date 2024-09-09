import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/helpers';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import TeamClient from './team-client';

export default async function TeamPage() {
  const currentUser = await requireAuth();
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');

  const supabase = await createClient();

  const { data: members } = await supabase
    .from('club_members')
    .select('id, user_id, role, is_active, created_at, profiles(id, full_name, email, avatar_url, phone)')
    .eq('club_id', clubId)
    .order('created_at');

  const { data: club } = await supabase
    .from('clubs')
    .select('name')
    .eq('id', clubId)
    .single();

  return (
    <TeamClient
      members={members ?? []}
      clubName={club?.name ?? 'Club'}
      currentUserId={currentUser.id}
    />
  );
}
