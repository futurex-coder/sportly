import { createClient } from '@/lib/supabase/server';
import UsersClient from './users-client';

interface ClubMembership {
  club_id: string;
  role: string;
  clubs: { name: string } | null;
}

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const userIds = profiles?.map((p) => p.id) ?? [];

  let memberships: Record<string, { clubName: string; role: string }[]> = {};

  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id, club_id, role, clubs(name)')
      .in('user_id', userIds) as { data: (ClubMembership & { user_id: string })[] | null };

    members?.forEach((m) => {
      if (!memberships[m.user_id]) memberships[m.user_id] = [];
      memberships[m.user_id].push({
        clubName: m.clubs?.name ?? 'Unknown',
        role: m.role,
      });
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm">
          View and manage all registered users.
        </p>
      </div>
      <UsersClient
        initialUsers={profiles ?? []}
        memberships={memberships}
      />
    </div>
  );
}
