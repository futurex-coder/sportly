import { requireAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import MyBookingsClient from './my-bookings-client';

interface BookingRow {
  id: string;
  field_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price_eur: number | null;
  total_price_local: number | null;
  notes: string | null;
  created_at: string;
  fields: {
    name: string;
    slug: string;
    location_id: string;
    sport_categories: { name: string; icon: string | null } | null;
    locations: {
      name: string;
      city: string;
      address: string;
      clubs: { name: string; slug: string };
    };
  };
}

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
    .limit(100)
    .returns<BookingRow[]>();

  const upcoming = (bookings ?? []).filter(
    (b) => b.date >= today && b.status !== 'cancelled'
  );
  const past = (bookings ?? []).filter(
    (b) => b.date < today || b.status === 'cancelled' || b.status === 'completed'
  );

  return <MyBookingsClient upcoming={upcoming} past={past} />;
}
