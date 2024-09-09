import { createClient } from '@/lib/supabase/server';

export async function getPostLoginRedirect(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role === 'super_admin') return '/admin';

  const { data: membership } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (membership) return '/dashboard';

  return '/';
}
