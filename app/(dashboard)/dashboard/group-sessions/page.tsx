import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/helpers';
import { getActiveClubId, getActiveLocationId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import GroupSessionsClient from './group-sessions-client';

export default async function DashboardGroupSessionsPage() {
  await requireAuth();
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');

  const activeLocationId = await getActiveLocationId();
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('name');

  const locationIds = activeLocationId
    ? [activeLocationId]
    : (locations?.map((l) => l.id) ?? []);

  if (locationIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Group Sessions</h1>
        <p className="text-muted-foreground">No locations found. Create a location first.</p>
      </div>
    );
  }

  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, location_id, locations(name), sport_categories(id, name, slug, icon)')
    .in('location_id', locationIds)
    .eq('is_active', true)
    .order('name');

  const fieldIds = fields?.map((f) => f.id) ?? [];

  let sessions: any[] = [];
  if (fieldIds.length > 0) {
    const { data } = await supabase
      .from('group_sessions')
      .select(
        `id, title, field_id, date, start_time, end_time, visibility,
         max_participants, current_participants,
         is_confirmed, is_cancelled, cancelled_reason, completed_at,
         organizer_id,
         profiles!group_sessions_organizer_id_fkey(full_name, email, avatar_url),
         sport_categories(id, name, icon)`
      )
      .in('field_id', fieldIds)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(200);

    sessions = data ?? [];
  }

  // Count pending requests per session
  const sessionIds = sessions.map((s) => s.id);
  let pendingCounts: Record<string, number> = {};
  if (sessionIds.length > 0) {
    const { data: pendingRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('status', 'requested');

    if (pendingRows) {
      for (const row of pendingRows) {
        pendingCounts[row.session_id] = (pendingCounts[row.session_id] ?? 0) + 1;
      }
    }
  }

  const fieldMap = Object.fromEntries(
    (fields ?? []).map((f) => [
      f.id,
      {
        name: f.name,
        locationName: (f.locations as any)?.name ?? '',
        locationId: f.location_id,
        sportName: (f.sport_categories as any)?.name ?? '',
        sportIcon: (f.sport_categories as any)?.icon ?? '🏅',
      },
    ])
  );

  const sportCategories = Array.from(
    new Map(
      (fields ?? [])
        .map((f) => f.sport_categories as any)
        .filter(Boolean)
        .map((sc: any) => [sc.id, { id: sc.id, name: sc.name, icon: sc.icon }])
    ).values()
  );

  return (
    <GroupSessionsClient
      sessions={sessions}
      fieldMap={fieldMap}
      locations={locations ?? []}
      sportCategories={sportCategories}
      pendingCounts={pendingCounts}
      activeLocationId={activeLocationId}
    />
  );
}
