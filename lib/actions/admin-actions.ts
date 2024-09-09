'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './types';

// ─── Sport Categories ───────────────────────────────

export async function createSportCategory(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const name = formData.get('name') as string;
    const slug = (formData.get('slug') as string) || name.toLowerCase().replace(/\s+/g, '-');
    const icon = formData.get('icon') as string | null;
    const colorPrimary = formData.get('colorPrimary') as string | null;
    const colorAccent = formData.get('colorAccent') as string | null;
    const description = formData.get('description') as string | null;

    const { data: maxOrder } = await supabase
      .from('sport_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { error } = await supabase.from('sport_categories').insert({
      name,
      slug,
      icon,
      color_primary: colorPrimary,
      color_accent: colorAccent,
      description,
      sort_order: (maxOrder?.sort_order ?? 0) + 1,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/sport-categories');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create sport category' };
  }
}

export async function updateSportCategory(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    const name = formData.get('name') as string | null;
    const slug = formData.get('slug') as string | null;
    const icon = formData.get('icon') as string | null;
    const colorPrimary = formData.get('colorPrimary') as string | null;
    const colorAccent = formData.get('colorAccent') as string | null;
    const description = formData.get('description') as string | null;

    if (name !== null) updates.name = name;
    if (slug !== null) updates.slug = slug;
    if (icon !== null) updates.icon = icon;
    if (colorPrimary !== null) updates.color_primary = colorPrimary;
    if (colorAccent !== null) updates.color_accent = colorAccent;
    if (description !== null) updates.description = description;

    const { error } = await supabase
      .from('sport_categories')
      .update(updates)
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/sport-categories');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update sport category' };
  }
}

export async function toggleSportCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from('sport_categories')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/sport-categories');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to toggle category status' };
  }
}

export async function deleteSportCategory(id: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const { count } = await supabase
      .from('fields')
      .select('id', { count: 'exact', head: true })
      .eq('sport_category_id', id);

    if (count && count > 0) {
      return { success: false, error: `Cannot delete: ${count} field(s) use this category.` };
    }

    const { error } = await supabase
      .from('sport_categories')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/sport-categories');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to delete sport category' };
  }
}

export async function reorderSportCategories(orderedIds: string[]): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const updates = orderedIds.map((id, index) =>
      supabase
        .from('sport_categories')
        .update({ sort_order: index + 1 })
        .eq('id', id)
    );

    await Promise.all(updates);

    revalidatePath('/admin/sport-categories');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to reorder categories' };
  }
}

// ─── Clubs ──────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createClub(formData: FormData): Promise<ActionResult<{ clubId: string }>> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const name = formData.get('name') as string;
    const slug = (formData.get('slug') as string) || generateSlug(name);
    const email = (formData.get('email') as string) || null;
    const phone = (formData.get('phone') as string) || null;
    const city = (formData.get('city') as string) || null;
    const description = (formData.get('description') as string) || null;
    const logoUrl = (formData.get('logoUrl') as string) || null;

    const { data, error } = await supabase
      .from('clubs')
      .insert({ name, slug, email, phone, city, description, logo_url: logoUrl })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/clubs');
    return { success: true, data: { clubId: data.id as string } };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to create club' };
  }
}

export async function updateClub(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    const name = formData.get('name') as string | null;
    const slug = formData.get('slug') as string | null;
    const email = formData.get('email') as string | null;
    const phone = formData.get('phone') as string | null;
    const city = formData.get('city') as string | null;
    const description = formData.get('description') as string | null;

    if (name !== null) updates.name = name;
    if (slug !== null) updates.slug = slug;
    if (email !== null) updates.email = email;
    if (phone !== null) updates.phone = phone;
    if (city !== null) updates.city = city;
    if (description !== null) updates.description = description;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('clubs').update(updates).eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/clubs');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update club' };
  }
}

export async function toggleClubActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from('clubs')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/clubs');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to toggle club status' };
  }
}

export async function deleteClub(id: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const { count: locCount } = await supabase
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', id);

    if (locCount && locCount > 0) {
      return { success: false, error: `Cannot delete: club has ${locCount} location(s). Remove them first.` };
    }

    const { error } = await supabase.from('clubs').delete().eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/clubs');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to delete club' };
  }
}

export async function inviteClubAdmin(clubId: string, email: string): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      return { success: false, error: 'No user found with that email. They must register first.' };
    }

    const { error } = await supabase.from('club_members').insert({
      club_id: clubId,
      user_id: profile.id,
      role: 'club_admin',
    });

    if (error) {
      if (error.code === '23505') return { success: false, error: 'User is already a member of this club.' };
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/clubs');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to invite club admin' };
  }
}

// ─── Users ──────────────────────────────────────────

export async function updateUserRole(
  userId: string,
  role: 'super_admin' | 'club_admin' | 'staff' | 'trainer' | 'client'
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/users');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Failed to update user role' };
  }
}
