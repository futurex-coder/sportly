import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClubListingClient from './club-listing-client';

export default async function SportClubsPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ city?: string }>;
}) {
  const { category: slug } = await params;
  const { city: cityFilter } = await searchParams;
  const supabase = await createClient();

  const { data: sport } = await supabase
    .from('sport_categories')
    .select('id, name, slug, icon, color_primary')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!sport) notFound();

  // Fetch fields for this sport with location + club + booking settings
  const { data: fields } = await supabase
    .from('fields')
    .select(
      `id, name, sport_category_id, location_id,
       locations!inner(id, address, city, clubs!inner(id, name, slug, city, logo_url, description, email, phone, is_active)),
       field_booking_settings(slot_duration_minutes, price_per_slot_eur, price_per_slot_local, currency_local)`
    )
    .eq('sport_category_id', sport.id)
    .eq('is_active', true)
    .eq('locations.clubs.is_active', true);

  // Aggregate per club: name, address, price range
  interface ClubRow {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    logoUrl: string | null;
    description: string | null;
    addresses: string[];
    cities: string[];
    minPriceEur: number | null;
    maxPriceEur: number | null;
    minPriceLocal: number | null;
    maxPriceLocal: number | null;
    slotDuration: number | null;
    currency: string;
    fieldCount: number;
  }

  const clubMap = new Map<string, ClubRow>();

  (fields ?? []).forEach((f) => {
    const loc = f.locations as any;
    const club = loc?.clubs;
    if (!club) return;

    let row = clubMap.get(club.id);
    if (!row) {
      row = {
        id: club.id,
        name: club.name,
        slug: club.slug,
        city: club.city,
        logoUrl: club.logo_url,
        description: club.description,
        addresses: [],
        cities: [],
        minPriceEur: null,
        maxPriceEur: null,
        minPriceLocal: null,
        maxPriceLocal: null,
        slotDuration: null,
        currency: 'BGN',
        fieldCount: 0,
      };
      clubMap.set(club.id, row);
    }

    row.fieldCount++;

    const addr = loc.address;
    if (addr && !row.addresses.includes(addr)) row.addresses.push(addr);

    const c = loc.city;
    if (c && !row.cities.includes(c)) row.cities.push(c);

    // Booking settings can be array or single object depending on Supabase join
    const bs = Array.isArray(f.field_booking_settings)
      ? f.field_booking_settings[0]
      : f.field_booking_settings;
    if (bs) {
      const eur = Number(bs.price_per_slot_eur);
      const local = bs.price_per_slot_local != null ? Number(bs.price_per_slot_local) : null;

      if (!isNaN(eur)) {
        if (row.minPriceEur === null || eur < row.minPriceEur) row.minPriceEur = eur;
        if (row.maxPriceEur === null || eur > row.maxPriceEur) row.maxPriceEur = eur;
      }
      if (local !== null && !isNaN(local)) {
        if (row.minPriceLocal === null || local < row.minPriceLocal) row.minPriceLocal = local;
        if (row.maxPriceLocal === null || local > row.maxPriceLocal) row.maxPriceLocal = local;
      }
      if (bs.slot_duration_minutes) row.slotDuration = bs.slot_duration_minutes;
      if (bs.currency_local) row.currency = bs.currency_local;
    }
  });

  let clubRows = Array.from(clubMap.values());

  // Collect unique cities for filter dropdown
  const allCities = Array.from(
    new Set(clubRows.flatMap((c) => c.cities).filter(Boolean))
  ).sort();

  // Apply city filter server-side if present
  if (cityFilter) {
    clubRows = clubRows.filter((c) =>
      c.cities.some((ct) => ct.toLowerCase() === cityFilter.toLowerCase())
    );
  }

  // Sort: clubs with prices first, then alphabetical
  clubRows.sort((a, b) => {
    if (a.minPriceEur !== null && b.minPriceEur === null) return -1;
    if (a.minPriceEur === null && b.minPriceEur !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <ClubListingClient
      sport={sport}
      clubs={clubRows}
      cities={allCities}
      initialCity={cityFilter ?? ''}
    />
  );
}
