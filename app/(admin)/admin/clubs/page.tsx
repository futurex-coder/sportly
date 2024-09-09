import { createClient } from '@/lib/supabase/server';
import ClubsClient from './clubs-client';

export default async function AdminClubsPage() {
  const supabase = await createClient();

  const { data: clubs } = await supabase
    .from('clubs')
    .select('*')
    .order('created_at', { ascending: false });

  const clubIds = clubs?.map((c) => c.id) ?? [];

  let locationCounts: Record<string, number> = {};
  let memberCounts: Record<string, number> = {};

  if (clubIds.length > 0) {
    const { data: locations } = await supabase
      .from('locations')
      .select('club_id')
      .in('club_id', clubIds);

    locations?.forEach((l) => {
      locationCounts[l.club_id] = (locationCounts[l.club_id] || 0) + 1;
    });

    const { data: members } = await supabase
      .from('club_members')
      .select('club_id')
      .in('club_id', clubIds);

    members?.forEach((m) => {
      memberCounts[m.club_id] = (memberCounts[m.club_id] || 0) + 1;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clubs</h1>
        <p className="text-muted-foreground text-sm">
          Manage clubs and impersonate their dashboards.
        </p>
      </div>
      <ClubsClient
        initialClubs={clubs ?? []}
        locationCounts={locationCounts}
        memberCounts={memberCounts}
      />
    </div>
  );
}
