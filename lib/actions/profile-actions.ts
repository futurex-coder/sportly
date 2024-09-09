'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './types';

export async function updateProfile(data: {
  fullName?: string;
  phone?: string;
  city?: string;
  avatarUrl?: string;
}): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.fullName !== undefined) updates.full_name = data.fullName;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.city !== undefined) updates.city = data.city;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/my/profile');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update profile' };
  }
}
