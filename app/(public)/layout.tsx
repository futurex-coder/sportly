import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import PublicNavbar from '@/components/layout/public-navbar';
import SportIconBar from '@/components/layout/sport-icon-bar';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon, color_primary')
    .eq('is_active', true)
    .order('sort_order');

  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar user={user} />
      <SportIconBar categories={categories ?? []} />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8">
        <div className="text-muted-foreground mx-auto max-w-7xl px-4 text-center text-sm">
          &copy; {new Date().getFullYear()} Sportly. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
