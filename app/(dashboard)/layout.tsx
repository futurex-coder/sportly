import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/helpers';
import {
  getActiveClubId,
  getActiveLocationId,
  getImpersonatedClubId,
} from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/app-shell';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import ImpersonationBanner from '@/components/layout/impersonation-banner';
import LocationSelector from '@/components/layout/location-selector';
import {
  stopImpersonation,
  switchActiveLocation,
} from '@/lib/actions/impersonation-actions';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');

  const supabase = await createClient();

  const { data: club } = await supabase
    .from('clubs')
    .select('id, name')
    .eq('id', clubId)
    .single();

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('name');

  const activeLocationId = await getActiveLocationId();
  const impersonatedClubId = await getImpersonatedClubId();
  const isImpersonating =
    user.role === 'super_admin' && impersonatedClubId !== null;

  return (
    <>
      {isImpersonating && club && (
        <ImpersonationBanner
          clubName={club.name}
          onExit={stopImpersonation}
        />
      )}
      <AppShell
        sidebar={<DashboardSidebar />}
        topBar={
          <div className="flex items-center gap-4">
            {club && (
              <span className="text-sm font-semibold">{club.name}</span>
            )}
            <LocationSelector
              locations={locations ?? []}
              activeLocationId={activeLocationId}
              onSelect={switchActiveLocation}
            />
          </div>
        }
      >
        {children}
      </AppShell>
    </>
  );
}
