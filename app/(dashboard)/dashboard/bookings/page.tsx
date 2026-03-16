import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/helpers';
import { getActiveClubId, getActiveLocationId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import BookingsClient from './bookings-client';

interface FieldRow {
  id: string;
  name: string;
  location_id: string;
  sport_category_id: string | null;
  locations: { name: string } | null;
}

interface MemberRow {
  user_id: string;
  profiles: { id: string; full_name: string | null; email: string } | null;
}

export default async function BookingsPage() {
  await requireAuth();
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');

  const activeLocationId = await getActiveLocationId();
  const supabase = await createClient();

  let locationsQuery = supabase
    .from('locations')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('name');

  const { data: locations } = await locationsQuery;
  const locationIds = activeLocationId
    ? [activeLocationId]
    : (locations?.map((l) => l.id) ?? []);

  if (locationIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">No locations found. Create a location first.</p>
      </div>
    );
  }

  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, location_id, sport_category_id, locations(name)')
    .in('location_id', locationIds)
    .eq('is_active', true)
    .order('name')
    .returns<FieldRow[]>();

  const fieldIds = fields?.map((f) => f.id) ?? [];

  let bookings: any[] = [];
  if (fieldIds.length > 0) {
    const { data } = await supabase
      .from('bookings')
      .select(
        'id, field_id, user_id, date, start_time, end_time, status, total_price_eur, total_price_local, notes, booked_by, created_at, profiles!bookings_user_id_fkey(full_name, email)'
      )
      .in('field_id', fieldIds)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(200);

    bookings = data ?? [];
  }

  const { data: clubMembers } = await supabase
    .from('club_members')
    .select('user_id, profiles(id, full_name, email)')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .returns<MemberRow[]>();

  const members = (clubMembers ?? [])
    .map((m) => m.profiles)
    .filter((p): p is NonNullable<typeof p> => !!p);

  const fieldMap = Object.fromEntries(
    (fields ?? []).map((f) => [
      f.id,
      { name: f.name, locationName: f.locations?.name ?? '', locationId: f.location_id },
    ])
  );

  return (
    <BookingsClient
      bookings={bookings}
      fieldMap={fieldMap}
      locations={locations ?? []}
      fields={fields ?? []}
      members={members}
      activeLocationId={activeLocationId}
    />
  );
}
