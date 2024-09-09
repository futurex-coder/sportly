import { requireAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import MyBookingsClient from './my-bookings-client';

export default async function MyBookingsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `id, field_id, date, start_time, end_time, status, total_price_eur, total_price_local, notes, created_at,
       fields!inner(name, slug, location_id, sport_categories(name, icon),
         locations!inner(name, city, address, clubs!inner(name, slug)))`
    )
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(100);

  const upcoming = (bookings ?? []).filter(
    (b) => b.date >= today && b.status !== 'cancelled'
  );
  const past = (bookings ?? []).filter(
    (b) => b.date < today || b.status === 'cancelled' || b.status === 'completed'
  );

  return <MyBookingsClient upcoming={upcoming} past={past} />;
}
