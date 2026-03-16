import { redirect } from 'next/navigation';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { requireClubAccess } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import LocationDetailClient from './location-detail-client';

interface FieldRow {
  id: string;
  name: string;
  slug: string;
  sport_category_id: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  sport_categories: { name: string; icon: string | null } | null;
}

export default async function LocationDetailPage({
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
    .select('*')
    .eq('id', locationId)
    .eq('club_id', clubId)
    .single();

  if (!location) redirect('/dashboard/locations');

  const { data: schedule } = await supabase
    .from('location_schedules')
    .select('*')
    .eq('location_id', locationId)
    .order('day_of_week');

  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, slug, sport_category_id, is_active, sort_order, sport_categories(name, icon)')
    .eq('location_id', locationId)
    .order('sort_order')
    .returns<FieldRow[]>();

  return (
    <LocationDetailClient
      location={location}
      schedule={schedule ?? []}
      fields={fields ?? []}
    />
  );
}
