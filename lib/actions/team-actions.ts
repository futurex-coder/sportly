'use server';

import { revalidatePath } from 'next/cache';
import { requireClubAccess } from '@/lib/auth/helpers';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './types';

type ClubRole = 'club_admin' | 'staff' | 'trainer';

export async function inviteTeamMember(email: string, role: ClubRole): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      return { success: false, error: 'No user found with that email. They must register first.' };
    }

    const { data: existing } = await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', profile.id)
      .single();

    if (existing) {
      return { success: false, error: 'This user is already a member of this club.' };
    }

    const { error } = await supabase.from('club_members').insert({
      club_id: clubId,
      user_id: profile.id,
      role,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/team');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to invite team member' };
  }
}

export async function changeTeamMemberRole(memberId: string, role: ClubRole): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { error } = await supabase
      .from('club_members')
      .update({ role })
      .eq('id', memberId)
      .eq('club_id', clubId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/team');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to change role' };
  }
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('id', memberId)
      .eq('club_id', clubId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/team');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to remove member' };
  }
}

export async function toggleTeamMemberActive(memberId: string, isActive: boolean): Promise<ActionResult> {
  try {
    const clubId = await getActiveClubId();
    if (!clubId) return { success: false, error: 'No active club' };
    await requireClubAccess(clubId);

    const supabase = await createClient();

    const { error } = await supabase
      .from('club_members')
      .update({ is_active: isActive })
      .eq('id', memberId)
      .eq('club_id', clubId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/team');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update member status' };
  }
}
