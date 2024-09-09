import { redirect } from 'next/navigation';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { requireClubAccess } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import FieldDetailClient from './field-detail-client';

export default async function FieldDetailPage({
  params,
}: {
  params: Promise<{ id: string; fieldId: string }>;
}) {
  const { id: locationId, fieldId } = await params;
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');
  await requireClubAccess(clubId);

  const supabase = await createClient();

  const { data: field } = await supabase
    .from('fields')
    .select('*, sport_categories(id, name, icon)')
    .eq('id', fieldId)
    .eq('location_id', locationId)
    .single();

  if (!field) redirect(`/dashboard/locations/${locationId}`);

  const { data: attributes } = await supabase
    .from('field_attributes')
    .select('*')
    .eq('field_id', fieldId);

  const { data: bookingSettings } = await supabase
    .from('field_booking_settings')
    .select('*')
    .eq('field_id', fieldId)
    .single();

  const { data: availability } = await supabase
    .from('field_availability')
    .select('*')
    .eq('field_id', fieldId);

  const { data: sportCategories } = await supabase
    .from('sport_categories')
    .select('id, name, icon')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <FieldDetailClient
      locationId={locationId}
      field={field}
      attributes={attributes ?? []}
      bookingSettings={bookingSettings}
      availability={availability ?? []}
      sportCategories={sportCategories ?? []}
    />
  );
}
