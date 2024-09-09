import { getActiveClubId } from '@/lib/auth/impersonation';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NewLocationWizard from './new-location-wizard';

export default async function NewLocationPage() {
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');

  const supabase = await createClient();
  const { data: sportCategories } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Location</h1>
        <p className="text-muted-foreground text-sm">
          Set up a new venue with schedule and optional fields.
        </p>
      </div>
      <NewLocationWizard
        clubId={clubId}
        sportCategories={sportCategories ?? []}
      />
    </div>
  );
}
