import { redirect } from 'next/navigation';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { requireClubAccess } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import NewFieldWizard from './new-field-wizard';

export default async function NewFieldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: locationId } = await params;
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');
  await requireClubAccess(clubId);

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id, name, club_id')
    .eq('id', locationId)
    .eq('club_id', clubId)
    .single();

  if (!location) redirect('/dashboard/locations');

  const { data: sportCategories } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Field</h1>
        <p className="text-muted-foreground text-sm">
          Add a bookable resource to <strong>{location.name}</strong>.
        </p>
      </div>
      <NewFieldWizard
        locationId={locationId}
        sportCategories={sportCategories ?? []}
      />
    </div>
  );
}
