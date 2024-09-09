import { requireSuperAdmin } from '@/lib/auth/helpers';
import { getImpersonatedClubId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/app-shell';
import AdminSidebar from '@/components/layout/admin-sidebar';
import ImpersonationBanner from '@/components/layout/impersonation-banner';
import ClubSelector from '@/components/layout/club-selector';
import {
  impersonateClub,
  stopImpersonation,
} from '@/lib/actions/impersonation-actions';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  const supabase = await createClient();

  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, slug')
    .order('name');

  const impersonatedClubId = await getImpersonatedClubId();
  let impersonatedClubName: string | null = null;
  if (impersonatedClubId) {
    const club = clubs?.find((c) => c.id === impersonatedClubId);
    impersonatedClubName = club?.name ?? null;
  }

  return (
    <>
      {impersonatedClubName && (
        <ImpersonationBanner
          clubName={impersonatedClubName}
          onExit={stopImpersonation}
        />
      )}
      <AppShell
        sidebar={<AdminSidebar />}
        topBar={
          <ClubSelector clubs={clubs ?? []} onSelect={impersonateClub} />
        }
      >
        {children}
      </AppShell>
    </>
  );
}
