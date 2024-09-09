import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';
import NewSessionWizard from './new-session-wizard';

export default async function NewSessionPage() {
  await requireAuth();

  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon, color_primary')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Create Group Session</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Pick a sport, choose a field and time, then invite players.
      </p>
      <NewSessionWizard categories={categories ?? []} />
    </div>
  );
}
